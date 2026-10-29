import React, { useEffect, useRef, useState } from 'react';
import {
  Monitor,
  Zap,
  ZoomIn,
  SwitchCamera,
  Camera,
  CircleDot,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Maximize2,
  AlertTriangle,
  Eye,
  RefreshCw,
  Sliders,
  Shield,
  Activity,
  Download,
  Wifi,
  Radio,
  Play,
  Square,
  Sparkles,
} from 'lucide-react';
import { CameraCurrentSettings, RemoteCommand } from '../types/camera';
import { WebRTCManager } from '../utils/webrtc';

interface ControllerViewProps {
  roomId: string;
  pin: string;
  onRoomChange: (newRoomId: string, newPin: string) => void;
}

export const ControllerView: React.FC<ControllerViewProps> = ({
  roomId,
  pin,
  onRoomChange,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const intercomAudioRef = useRef<HTMLAudioElement>(null);
  const webrtcRef = useRef<WebRTCManager | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const intercomStreamRef = useRef<MediaStream | null>(null);

  const [connectionStatus, setConnectionStatus] = useState<
    'disconnected' | 'connecting' | 'connected' | 'reconnecting'
  >('disconnected');
  const [telemetry, setTelemetry] = useState({ fps: 30, latencyMs: 24, bytesReceived: 0 });
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isIntercomActive, setIsIntercomActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // Target camera mirrored states
  const [remoteTorch, setRemoteTorch] = useState(false);
  const [remoteZoom, setRemoteZoom] = useState(1);
  const [remoteExposure, setRemoteExposure] = useState(0);
  const [remoteFacing, setRemoteFacing] = useState<'user' | 'environment'>('environment');
  const [remoteResolution, setRemoteResolution] = useState<'4k' | '1080p' | '720p' | '480p'>('1080p');
  const [remoteNightVision, setRemoteNightVision] = useState(false);

  // Input states
  const [targetRoomInput, setTargetRoomInput] = useState(roomId);
  const [targetPinInput, setTargetPinInput] = useState(pin);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Handle URL query parameters if opened via QR code or direct link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    const pinParam = params.get('pin');
    if (roomParam) {
      setTargetRoomInput(roomParam);
      onRoomChange(roomParam, pinParam || '');
    }
  }, []);

  useEffect(() => {
    let timer: any;
    if (isRecording) {
      timer = setInterval(() => {
        setRecordingSeconds(s => s + 1);
      }, 1000);
    } else {
      setRecordingSeconds(0);
    }
    return () => clearInterval(timer);
  }, [isRecording]);

  /**
   * Connect to target IP Camera
   */
  const connectToCamera = async () => {
    if (!targetRoomInput.trim()) {
      alert('Please enter a valid Camera Room ID or IP Code');
      return;
    }

    onRoomChange(targetRoomInput.trim(), targetPinInput.trim());
    setConnectionStatus('connecting');
    setStatusMessage('Negotiating low-latency P2P camera stream...');

    const myPeerId = `controller-${Math.random().toString(36).substring(2, 7)}`;
    const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
    const platform = isMobile ? 'android' : 'windows';

    // Register with signaling server
    try {
      const joinRes = await fetch(`/api/signal/room/${targetRoomInput.trim()}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          peerId: myPeerId,
          type: 'controller',
          deviceName: isMobile ? 'Remote Mobile Controller' : 'Remote PC Control Hub',
          platform,
          pin: targetPinInput.trim(),
        }),
      });

      if (!joinRes.ok) {
        const errData = await joinRes.json();
        throw new Error(errData.error || 'Connection rejected');
      }

      const roomData = await joinRes.json();
      if (roomData.cameraSettings?.settings) {
        const s = roomData.cameraSettings.settings;
        setRemoteTorch(!!s.torch);
        setRemoteZoom(s.zoom || 1);
        setRemoteFacing(s.facingMode || 'environment');
        setRemoteResolution(s.resolution || '1080p');
      }

      // Initialize WebRTC as controller
      const webrtc = new WebRTCManager({
        roomId: targetRoomInput.trim(),
        peerId: myPeerId,
        isBroadcaster: false,
        onRemoteStream: (stream: MediaStream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(console.warn);
          }
          setConnectionStatus('connected');
          setStatusMessage('Connected to live camera feed!');
        },
        onStatusChange: (status) => {
          setConnectionStatus(status);
        },
        onTelemetryUpdate: (stats) => {
          setTelemetry(stats);
        },
        onCommandReceived: (cmd: RemoteCommand) => {
          // Sync changes made directly on the camera
          if (cmd.type === 'SET_TORCH') setRemoteTorch(!!cmd.payload);
          if (cmd.type === 'SET_ZOOM') setRemoteZoom(Number(cmd.payload));
          if (cmd.type === 'SWITCH_CAMERA') setRemoteFacing(f => f === 'user' ? 'environment' : 'user');
        },
      });

      await webrtc.start();
      webrtcRef.current = webrtc;
    } catch (err: any) {
      console.error('Connection failed:', err);
      setConnectionStatus('disconnected');
      setStatusMessage(`Connection failed: ${err.message || 'Check IP or Room ID'}`);
    }
  };

  /**
   * Disconnect from camera
   */
  const disconnectCamera = () => {
    if (webrtcRef.current) {
      webrtcRef.current.destroy();
      webrtcRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setConnectionStatus('disconnected');
    setStatusMessage('');
  };

  /**
   * Send remote command to the camera device
   */
  const sendRemoteCommand = (type: any, payload?: any) => {
    if (!webrtcRef.current) return;
    const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
    const cmd: RemoteCommand = {
      type,
      payload,
      timestamp: Date.now(),
      senderName: isMobile ? 'Remote Phone' : 'Remote PC',
    };
    webrtcRef.current.sendCommand(cmd);
  };

  // Remote Torch
  const toggleRemoteTorch = () => {
    const next = !remoteTorch;
    setRemoteTorch(next);
    sendRemoteCommand('SET_TORCH', next);
  };

  // Remote Zoom
  const changeRemoteZoom = (val: number) => {
    setRemoteZoom(val);
    sendRemoteCommand('SET_ZOOM', val);
  };

  // Remote Switch Camera
  const flipRemoteCamera = () => {
    const next = remoteFacing === 'user' ? 'environment' : 'user';
    setRemoteFacing(next);
    sendRemoteCommand('SWITCH_CAMERA', next);
  };

  // Remote Resolution
  const changeRemoteResolution = (res: '4k' | '1080p' | '720p' | '480p') => {
    setRemoteResolution(res);
    sendRemoteCommand('SET_RESOLUTION', res);
  };

  // Remote Photo Snapshot
  const snapRemotePhoto = () => {
    sendRemoteCommand('TAKE_PHOTO');
    // Also take local snapshot from current stream frame
    if (videoRef.current && videoRef.current.videoWidth > 0) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Remote-Camera-Photo-${Date.now()}.jpg`;
            a.click();
          }
        }, 'image/jpeg', 0.95);
      }
    }
  };

  // Remote Siren Alarm
  const triggerRemoteSiren = () => {
    sendRemoteCommand('TRIGGER_ALARM');
  };

  // Remote Night Vision toggle
  const toggleRemoteNightVision = () => {
    setRemoteNightVision(n => !n);
    sendRemoteCommand('TOGGLE_NIGHT_VISION');
  };

  // Two-way Intercom (Microphone from controller to phone/PC)
  const toggleIntercom = async () => {
    if (isIntercomActive) {
      if (intercomStreamRef.current) {
        intercomStreamRef.current.getTracks().forEach(t => t.stop());
        intercomStreamRef.current = null;
      }
      setIsIntercomActive(false);
      sendRemoteCommand('TALK_AUDIO_STOP');
    } else {
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        intercomStreamRef.current = audioStream;
        setIsIntercomActive(true);
        sendRemoteCommand('TALK_AUDIO_START');

        // Add audio track to peer connection if available
        if (webrtcRef.current && audioStream.getAudioTracks()[0]) {
          await webrtcRef.current.replaceTrack(audioStream.getAudioTracks()[0]);
        }
      } catch (err) {
        alert('Could not access microphone for Intercom talkback.');
      }
    }
  };

  // Record live stream to file
  const toggleRecording = () => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } else {
      if (!videoRef.current?.srcObject) return;
      const stream = videoRef.current.srcObject as MediaStream;
      recordedChunksRef.current = [];

      try {
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' });
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            recordedChunksRef.current.push(e.data);
          }
        };
        recorder.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `CamLink-Recording-${Date.now()}.webm`;
          a.click();
        };
        recorder.start(1000);
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
      } catch (err) {
        console.error('Recording failed:', err);
      }
    }
  };

  const togglePictureInPicture = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (videoRef.current.requestPictureInPicture) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('PiP error:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Connection Header & IP Input */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/10 text-blue-400">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Remote Camera Controller Hub
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                Remotely control flashlight, hardware zoom, lens direction, exposure, and audio of any connected camera.
              </p>
            </div>
          </div>

          {/* Quick Connect Inputs */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <input
                type="text"
                placeholder="Camera Code / IP"
                value={targetRoomInput}
                onChange={e => setTargetRoomInput(e.target.value)}
                className="w-40 sm:w-48 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-blue-500 placeholder:text-slate-600"
              />
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="PIN (if set)"
                value={targetPinInput}
                onChange={e => setTargetPinInput(e.target.value)}
                className="w-24 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-500 placeholder:text-slate-600"
              />
            </div>

            {connectionStatus !== 'connected' ? (
              <button
                onClick={connectToCamera}
                disabled={connectionStatus === 'connecting'}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition disabled:opacity-50 cursor-pointer"
              >
                {connectionStatus === 'connecting' ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current" />
                )}
                <span>{connectionStatus === 'connecting' ? 'Connecting...' : 'Connect'}</span>
              </button>
            ) : (
              <button
                onClick={disconnectCamera}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition cursor-pointer"
              >
                <Square className="w-3 h-3 fill-current text-rose-500" />
                <span>Disconnect</span>
              </button>
            )}
          </div>
        </div>

        {statusMessage && (
          <p className="mt-3 text-xs text-blue-400 font-mono flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
            <span>{statusMessage}</span>
          </p>
        )}
      </div>

      {/* Main Grid: Stream Screen + Remote PTZ Control Pad */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Remote Live Video Screen */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative aspect-video rounded-2xl bg-black border border-slate-800 overflow-hidden shadow-2xl flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted={isAudioMuted}
              className={`w-full h-full object-contain ${
                remoteNightVision ? 'brightness-150 contrast-125 saturate-150' : ''
              }`}
            />

            {/* Offline placeholder */}
            {connectionStatus !== 'connected' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950/95 text-slate-400 space-y-3">
                <div className="p-4 rounded-full bg-slate-900 border border-slate-800 text-slate-600">
                  <Monitor className="w-10 h-10" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-200">
                    {connectionStatus === 'connecting' ? 'Establishing WebRTC Feed...' : 'No Camera Feed'}
                  </h3>
                  <p className="text-xs text-slate-400 max-w-sm mt-1">
                    Enter the IP address or Room Code shown on the broadcaster device and click "Connect".
                  </p>
                </div>
              </div>
            )}

            {/* Live Telemetry & Control HUD */}
            {connectionStatus === 'connected' && (
              <>
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-xs pointer-events-none">
                  <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-white">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-bold text-[10px] tracking-wider uppercase">STREAMING</span>
                    <span className="font-mono text-slate-400 text-[10px]">
                      {telemetry.fps} FPS | {telemetry.latencyMs}ms | {remoteResolution}
                    </span>
                  </div>

                  {isRecording && (
                    <div className="flex items-center gap-1.5 bg-rose-600/90 text-white px-3 py-1 rounded-full font-mono font-bold text-xs animate-pulse">
                      <CircleDot className="w-3.5 h-3.5" />
                      <span>REC {recordingSeconds}s</span>
                    </div>
                  )}
                </div>

                {/* Floating Bottom Quick HUD */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between bg-black/60 backdrop-blur-md p-2 rounded-xl border border-white/10 text-white">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsAudioMuted(!isAudioMuted)}
                      className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition cursor-pointer"
                      title={isAudioMuted ? 'Unmute Audio' : 'Mute Audio'}
                    >
                      {isAudioMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={togglePictureInPicture}
                      className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition cursor-pointer"
                      title="Picture in Picture Mode"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={snapRemotePhoto}
                      className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition cursor-pointer"
                      title="Remote Snapshot"
                    >
                      <Camera className="w-4 h-4 text-cyan-400" />
                    </button>
                    <button
                      onClick={toggleRecording}
                      className={`p-1.5 rounded-lg transition cursor-pointer ${
                        isRecording ? 'bg-rose-600 text-white' : 'bg-white/10 hover:bg-white/20'
                      }`}
                      title={isRecording ? 'Stop Recording' : 'Record Stream'}
                    >
                      <CircleDot className="w-4 h-4 text-rose-400" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
                    <span>Zoom: {remoteZoom.toFixed(1)}x</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Quick Action Buttons Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              disabled={connectionStatus !== 'connected'}
              onClick={snapRemotePhoto}
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
            >
              <Camera className="w-4 h-4 text-cyan-400" />
              <span>Remote Snapshot</span>
            </button>

            <button
              disabled={connectionStatus !== 'connected'}
              onClick={toggleRecording}
              className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-semibold transition disabled:opacity-50 cursor-pointer ${
                isRecording
                  ? 'bg-rose-950/60 border-rose-500/50 text-rose-300'
                  : 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-white'
              }`}
            >
              <CircleDot className="w-4 h-4 text-rose-400" />
              <span>{isRecording ? `Stop REC (${recordingSeconds}s)` : 'Record Video'}</span>
            </button>

            <button
              disabled={connectionStatus !== 'connected'}
              onClick={toggleIntercom}
              className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-semibold transition disabled:opacity-50 cursor-pointer ${
                isIntercomActive
                  ? 'bg-indigo-950/80 border-indigo-500 text-indigo-300 animate-pulse'
                  : 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-white'
              }`}
            >
              {isIntercomActive ? <Mic className="w-4 h-4 text-indigo-400" /> : <MicOff className="w-4 h-4 text-slate-400" />}
              <span>{isIntercomActive ? 'Intercom Active' : 'Push-To-Talk'}</span>
            </button>

            <button
              disabled={connectionStatus !== 'connected'}
              onClick={triggerRemoteSiren}
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-amber-400 text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Trigger Siren</span>
            </button>
          </div>
        </div>

        {/* Right Column: Complete Remote Hardware Controls */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-400" />
                <span>Remote Camera Controls</span>
              </h3>
              <span className="text-[10px] text-blue-400 bg-blue-950 px-2 py-0.5 rounded font-mono">
                {connectionStatus === 'connected' ? 'LIVE SYNC' : 'STANDBY'}
              </span>
            </div>

            {/* Remote Flashlight / Torch */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <Zap className={`w-4 h-4 ${remoteTorch ? 'text-amber-400' : 'text-slate-500'}`} />
                  <span>Remote Flashlight / Torch</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Toggles the phone's physical rear LED
                </p>
              </div>

              <button
                disabled={connectionStatus !== 'connected'}
                onClick={toggleRemoteTorch}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  remoteTorch
                    ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/25'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                } disabled:opacity-50`}
              >
                {remoteTorch ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Remote Hardware Zoom Slider */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <ZoomIn className="w-3.5 h-3.5 text-blue-400" />
                  <span>Remote Optical / Digital Zoom</span>
                </span>
                <span className="font-mono text-blue-400 font-bold">{remoteZoom.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="0.1"
                value={remoteZoom}
                disabled={connectionStatus !== 'connected'}
                onChange={e => changeRemoteZoom(parseFloat(e.target.value))}
                className="w-full accent-blue-500 cursor-pointer disabled:opacity-50"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>1.0x (Wide)</span>
                <span>2.5x</span>
                <span>5.0x (Telephoto)</span>
              </div>
            </div>

            {/* Remote Lens Switcher */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <SwitchCamera className="w-3.5 h-3.5 text-blue-400" />
                <span>Remote Lens (Facing Mode)</span>
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  disabled={connectionStatus !== 'connected'}
                  onClick={flipRemoteCamera}
                  className={`py-2 px-3 rounded-lg text-xs font-medium transition cursor-pointer ${
                    remoteFacing === 'environment'
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  } disabled:opacity-50`}
                >
                  Back Camera
                </button>
                <button
                  disabled={connectionStatus !== 'connected'}
                  onClick={flipRemoteCamera}
                  className={`py-2 px-3 rounded-lg text-xs font-medium transition cursor-pointer ${
                    remoteFacing === 'user'
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  } disabled:opacity-50`}
                >
                  Front Camera
                </button>
              </div>
            </div>

            {/* Remote Resolution Control */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white">Remote Resolution</span>
                <span className="text-[10px] text-slate-400 font-mono">4K UHD / HD</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {(['4k', '1080p', '720p', '480p'] as const).map(res => (
                  <button
                    key={res}
                    disabled={connectionStatus !== 'connected'}
                    onClick={() => changeRemoteResolution(res)}
                    className={`py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition cursor-pointer ${
                      remoteResolution === res
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    } disabled:opacity-50`}
                  >
                    {res}
                  </button>
                ))}
              </div>
            </div>

            {/* Smart Night Vision Filter */}
            <button
              disabled={connectionStatus !== 'connected'}
              onClick={toggleRemoteNightVision}
              className={`w-full p-3.5 rounded-xl border text-left transition cursor-pointer ${
                remoteNightVision
                  ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-300'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900'
              } disabled:opacity-50`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <Eye className="w-4 h-4 text-emerald-400" />
                  <span>Enhanced Night Vision Filter</span>
                </div>
                <span className="text-xs font-mono font-bold">
                  {remoteNightVision ? 'ACTIVE' : 'OFF'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Dynamically boosts contrast and illumination for dark rooms
              </p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
