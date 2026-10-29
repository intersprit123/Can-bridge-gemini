import { RemoteCommand } from '../types/camera';

export interface WebRTCClientOptions {
  roomId: string;
  peerId: string;
  isBroadcaster: boolean;
  localStream?: MediaStream | null;
  onRemoteStream?: (stream: MediaStream) => void;
  onCommandReceived?: (cmd: RemoteCommand) => void;
  onStatusChange?: (status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting') => void;
  onTelemetryUpdate?: (stats: { fps: number; latencyMs: number; bytesReceived: number }) => void;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
};

export class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private eventSource: EventSource | null = null;
  private pollInterval: any = null;
  private lastPollTimestamp = 0;
  private options: WebRTCClientOptions;
  private isDestroyed = false;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private statsInterval: any = null;

  constructor(options: WebRTCClientOptions) {
    this.options = options;
  }

  /**
   * Start signaling and establish peer connection
   */
  async start() {
    this.isDestroyed = false;
    this.options.onStatusChange?.('connecting');

    // 1. Initialize RTCPeerConnection
    this.createPeerConnection();

    // 2. Attach local stream tracks if available
    if (this.options.localStream && this.peerConnection) {
      this.options.localStream.getTracks().forEach(track => {
        if (this.peerConnection && this.options.localStream) {
          this.peerConnection.addTrack(track, this.options.localStream);
        }
      });
    }

    // 3. Connect to SSE Signaling Stream
    this.connectSignaling();

    // 4. If Broadcaster, wait for controller or initiate offer
    if (this.options.isBroadcaster) {
      this.setupBroadcasterDataChannel();
    } else {
      // Controller initiates the negotiation / offer
      await this.initiateOffer();
    }

    // Start stats monitoring
    this.startStatsMonitoring();
  }

  private createPeerConnection() {
    this.peerConnection = new RTCPeerConnection(RTC_CONFIG);

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignalMessage('candidate', event.candidate.toJSON());
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      if (state === 'connected') {
        this.options.onStatusChange?.('connected');
      } else if (state === 'connecting') {
        this.options.onStatusChange?.('connecting');
      } else if (state === 'disconnected' || state === 'failed') {
        this.options.onStatusChange?.('disconnected');
      }
    };

    this.peerConnection.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.options.onRemoteStream?.(event.streams[0]);
      } else if (event.track) {
        const stream = new MediaStream([event.track]);
        this.options.onRemoteStream?.(stream);
      }
    };

    this.peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.setupDataChannelListeners();
    };
  }

  private setupBroadcasterDataChannel() {
    if (!this.peerConnection) return;
    try {
      this.dataChannel = this.peerConnection.createDataChannel('camera-controls', {
        ordered: true,
      });
      this.setupDataChannelListeners();
    } catch (err) {
      console.warn('Could not create data channel on broadcaster:', err);
    }
  }

  private setupDataChannelListeners() {
    if (!this.dataChannel) return;

    this.dataChannel.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        this.options.onCommandReceived?.(parsed);
      } catch (err) {
        console.warn('Failed to parse data channel message', err);
      }
    };

    this.dataChannel.onopen = () => {
      console.log('WebRTC DataChannel opened!');
    };
  }

  private async initiateOffer() {
    if (!this.peerConnection) return;

    try {
      if (!this.dataChannel) {
        this.dataChannel = this.peerConnection.createDataChannel('camera-controls', {
          ordered: true,
        });
        this.setupDataChannelListeners();
      }

      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await this.peerConnection.setLocalDescription(offer);

      await this.sendSignalMessage('offer', offer);
    } catch (err) {
      console.error('Error initiating offer:', err);
    }
  }

  private connectSignaling() {
    const sseUrl = `/api/signal/events/${this.options.roomId}/${this.options.peerId}`;

    try {
      this.eventSource = new EventSource(sseUrl);

      this.eventSource.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleSignalMessage(message);
        } catch (err) {
          console.warn('Invalid JSON in SSE message', err);
        }
      };

      this.eventSource.onerror = () => {
        // Fall back to polling if SSE drops
        if (!this.pollInterval) {
          this.startPollingFallback();
        }
      };
    } catch {
      this.startPollingFallback();
    }
  }

  private startPollingFallback() {
    if (this.pollInterval) return;
    this.pollInterval = setInterval(async () => {
      if (this.isDestroyed) return;
      try {
        const res = await fetch(
          `/api/signal/room/${this.options.roomId}/poll?since=${this.lastPollTimestamp}&peerId=${this.options.peerId}`
        );
        if (res.ok) {
          const data = await res.json();
          this.lastPollTimestamp = data.now || Date.now();
          if (Array.isArray(data.messages)) {
            data.messages.forEach((msg: any) => this.handleSignalMessage(msg));
          }
        }
      } catch (err) {
        console.warn('Signal polling error:', err);
      }
    }, 1200);
  }

  private async handleSignalMessage(message: any) {
    if (message.senderId === this.options.peerId) return;

    switch (message.type) {
      case 'offer':
        if (this.options.isBroadcaster) {
          await this.handleOffer(message.data);
        }
        break;

      case 'answer':
        await this.handleAnswer(message.data);
        break;

      case 'candidate':
        await this.handleCandidate(message.data);
        break;

      case 'camera-command':
        // Fallback command delivery via signaling if data channel is not yet open
        this.options.onCommandReceived?.(message.data);
        break;

      default:
        break;
    }
  }

  private async handleOffer(offer: RTCSessionDescriptionInit) {
    if (!this.peerConnection) return;
    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

      // Flush queued candidates
      while (this.pendingCandidates.length > 0) {
        const c = this.pendingCandidates.shift()!;
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(c));
      }

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      await this.sendSignalMessage('answer', answer);
    } catch (err) {
      console.error('Error handling offer:', err);
    }
  }

  private async handleAnswer(answer: RTCSessionDescriptionInit) {
    if (!this.peerConnection) return;
    try {
      if (this.peerConnection.signalingState !== 'stable') {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));

        // Flush queued candidates
        while (this.pendingCandidates.length > 0) {
          const c = this.pendingCandidates.shift()!;
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(c));
        }
      }
    } catch (err) {
      console.error('Error handling answer:', err);
    }
  }

  private async handleCandidate(candidate: RTCIceCandidateInit) {
    if (!this.peerConnection) return;
    try {
      if (this.peerConnection.remoteDescription && this.peerConnection.remoteDescription.type) {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        this.pendingCandidates.push(candidate);
      }
    } catch (err) {
      console.error('Error adding ICE candidate:', err);
    }
  }

  /**
   * Send a command to the remote peer (via low-latency DataChannel or signaling fallback)
   */
  async sendCommand(command: RemoteCommand) {
    const jsonStr = JSON.stringify(command);

    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(jsonStr);
        return;
      } catch (err) {
        console.warn('DataChannel send failed, falling back to signaling', err);
      }
    }

    // Signaling server fallback
    await this.sendSignalMessage('camera-command', command);
  }

  private async sendSignalMessage(type: string, data: any) {
    try {
      await fetch(`/api/signal/room/${this.options.roomId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: this.options.peerId,
          senderType: this.options.isBroadcaster ? 'camera' : 'controller',
          type,
          data,
        }),
      });
    } catch (err) {
      console.warn('Error sending signal message:', err);
    }
  }

  /**
   * Replace or add local media tracks on the fly (e.g. flipping front/back camera)
   */
  async replaceTrack(newTrack: MediaStreamTrack) {
    if (!this.peerConnection) return;
    const sender = this.peerConnection.getSenders().find(s => s.track?.kind === newTrack.kind);
    if (sender) {
      await sender.replaceTrack(newTrack);
    } else {
      if (this.options.localStream) {
        this.peerConnection.addTrack(newTrack, this.options.localStream);
      }
    }
  }

  private startStatsMonitoring() {
    this.statsInterval = setInterval(async () => {
      if (!this.peerConnection || this.isDestroyed) return;
      try {
        const stats = await this.peerConnection.getStats();
        let fps = 30;
        let latencyMs = 28;
        let bytesReceived = 0;

        stats.forEach((report) => {
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            if (report.framesPerSecond) fps = Math.round(report.framesPerSecond);
            if (report.bytesReceived) bytesReceived = report.bytesReceived;
          }
          if (report.type === 'candidate-pair' && report.currentRoundTripTime) {
            latencyMs = Math.round(report.currentRoundTripTime * 1000);
          }
        });

        this.options.onTelemetryUpdate?.({ fps, latencyMs, bytesReceived });
      } catch {
        // ignore stats errors
      }
    }, 2000);
  }

  /**
   * Cleanup connections
   */
  destroy() {
    this.isDestroyed = true;
    if (this.statsInterval) clearInterval(this.statsInterval);
    if (this.pollInterval) clearInterval(this.pollInterval);
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
  }
}
