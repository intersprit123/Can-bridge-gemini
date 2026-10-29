import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Video,
  VideoOff,
  Zap,
  ZoomIn,
  SunMedium,
  SwitchCamera,
  Mic,
  MicOff,
  Maximize2,
  Copy,
  Check,
  QrCode,
  Shield,
  Activity,
  AlertTriangle,
  Radio,
  Eye,
  Disc,
  Smartphone,
  Monitor,
  ExternalLink,
  Volume2,
} from 'lucide-react';
import { CameraCapabilities, CameraCurrentSettings, NetworkInfo, RemoteCommand } from '../types/camera';
import {
  extractCameraCapabilities,
  applyTorch,
  applyZoom,
  applyExposure,
  capturePhotoBlob,
  WakeLockManager,
  RESOLUTION_PRESETS,
  playAlertSiren,
} from '../utils/cameraControls';
import { WebRTCManager } from '../utils/webrtc';
import { QRCodeModal } from './QRCodeModal';

interface BroadcasterViewProps {
  roomId: string;
  pin: string;
  onRoomChange: (newRoomId: string, newPin: string) => void;
}

export const BroadcasterView: React.FC<BroadcasterViewProps> = ({
  roomId,
  pin,
  onRoomChange,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wakeLockRef = useRef<WakeLockManager>(new WakeLockManager());
  const webrtcManagerRef = useRef<WebRTCManager | null>(null);
  const motionCanvasRef = useRef<HTMLCanvasElement>(null);
  const lastFrameDataRef = useRef<ImageData | null>(null);

  const [isSharing, setIsSharing] = useState(false);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [selectedIpIndex, setSelectedIpIndex] = useState(0);
  const [showQR, setShowQR] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [activeViewers, setActiveViewers] = useState<any[]>([]);
  const [lastRemoteAction, setLastRemoteAction] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [motionDetectedCount, setMotionDetectedCount] = useState(0);
  const [isMotionTriggered, setIsMotionTriggered] = useState(false);

  // Camera capabilities and settings
  const [capabilities, setCapabilities] = useState<CameraCapabilities>({
    hasTorch: false,
    hasZoom: false,
    zoomMin: 1,
    zoomMax: 1,
    zoomStep: 0.1,
    hasExposureCompensation: false,
    exposureMin: -2,
    exposureMax: 2,
    exposureStep: 0.5,
    hasFacingMode: true,
    supportedFacingModes: ['user', 'environment'],
    hasWhiteBalance: false,
    hasFocusMode: false,
    widthMax: 1920,
    heightMax: 1080,
  });

  const [settings, setSettings] = useState<CameraCurrentSettings>({
    torch: false,
    zoom: 1,
    exposureCompensation: 0,
    facingMode: 'environment',
    resolution: '1080p',
    frameRate: 30,
    whiteBalance: 'continuous',
    focusMode: 'continuous',
    audioEnabled: true,
    nightVision: false,
    motionDetection: false,
    aspectRatio: 1.777,
  });

  // Fetch local network info on mount
  useEffect(() => {
    fetch('/api/network-info')
      .then(r => r.json())
      .then((data: NetworkInfo) => {
        setNetworkInfo(data);
      })
      .catch(err => console.warn('Network info fetch error:', err));

    return () => {
      stopCameraSharing();
    };
  }, []);

  // Compute pairing URL for remote device
  const getPairingUrl = () => {
    if (!networkInfo) return window.location.href;
    const ip = networkInfo.localIps[selectedIpIndex]?.address || networkInfo.hostHeader.split(':')[0];
    const port = networkInfo.port || 3000;
    const base = `${networkInfo.protocol}://${ip}:${port}`;
    return `${base}/?mode=control&room=${roomId}${pin ? `&pin=${pin}` : ''}`;
  };

  /**
   * Start camera capture & WebRTC broadcaster engine
   */
  const startCameraSharing = async () => {
    try {
      const resConfig = RESOLUTION_PRESETS[settings.resolution];
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: settings.facingMode },
          ...resConfig,
        },
        audio: settings.audioEnabled,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const caps = extractCameraCapabilities(videoTrack);
        setCapabilities(caps);
        if (caps.hasZoom) {
          setSettings(s => ({ ...s, zoom: caps.zoomMin }));
        }
      }

      // Activate Wake Lock to prevent sleep in background
      await wakeLockRef.current.request();

      // Register room with backend
      await fetch('/api/signal/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, pin }),
      });

      // Join room as camera broadcaster
      const myPeerId = `camera-${Math.random().toString(36).substring(2, 7)}`;
      const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
      const platform = isMobile ? 'android' : 'windows';

      const joinRes = await fetch(`/api/signal/room/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          peerId: myPeerId,
          type: 'camera',
          deviceName: isMobile ? 'Mobile Phone Camera' : 'PC HD Camera',
          platform,
          pin,
        }),
      });

      if (joinRes.ok) {
        const data = await joinRes.json();
        setActiveViewers(data.peers.filter((p: any) => p.type === 'controller'));
      }

      // Initialize WebRTC Manager
      const webrtc = new WebRTCManager({
        roomId,
        peerId: myPeerId,
        isBroadcaster: true,
        localStream: stream,
        onCommandReceived: (cmd: RemoteCommand) => {
          handleRemoteCommand(cmd);
        },
      });
      await webrtc.start();
      webrtcManagerRef.current = webrtc;

      // Publish current capabilities to room
      await fetch(`/api/signal/room/${roomId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: myPeerId,
          senderType: 'camera',
          type: 'camera-settings',
          data: {
            capabilities: extractCameraCapabilities(videoTrack),
            settings,
          },
        }),
      });

      setIsSharing(true);
    } catch (err: any) {
      console.error('Camera capture failed:', err);
      alert(`Camera access error: ${err.message || 'Permission denied or camera in use'}`);
    }
  };

  /**
   * Stop camera sharing
   */
  const stopCameraSharing = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (webrtcManagerRef.current) {
      webrtcManagerRef.current.destroy();
      webrtcManagerRef.current = null;
    }
    wakeLockRef.current.release();
    setIsSharing(false);
  };

  /**
   * Handle camera control commands sent by remote phone or PC
   */
  const handleRemoteCommand = async (cmd: RemoteCommand) => {
    setLastRemoteAction(`${cmd.senderName || 'Remote Device'}: ${cmd.type}`);
    setTimeout(() => setLastRemoteAction(null), 3500);

    const track = streamRef.current?.getVideoTracks()[0] || null;

    switch (cmd.type) {
      case 'SET_TORCH': {
        const enable = !!cmd.payload;
        const ok = await applyTorch(track, enable);
        setSettings(s => ({ ...s, torch: enable }));
        break;
      }
      case 'SET_ZOOM': {
        const zoomVal = Number(cmd.payload);
        await applyZoom(track, zoomVal);
        setSettings(s => ({ ...s, zoom: zoomVal }));
        break;
      }
      case 'SET_EXPOSURE': {
        const expVal = Number(cmd.payload);
        await applyExposure(track, expVal);
        setSettings(s => ({ ...s, exposureCompensation: expVal }));
        break;
      }
      case 'SWITCH_CAMERA': {
        const newMode = settings.facingMode === 'user' ? 'environment' : 'user';
        await switchFacingMode(newMode);
        break;
      }
      case 'SET_RESOLUTION': {
        if (cmd.payload && RESOLUTION_PRESETS[cmd.payload as keyof typeof RESOLUTION_PRESETS]) {
          await changeResolution(cmd.payload);
        }
        break;
      }
      case 'TAKE_PHOTO': {
        if (streamRef.current) {
          const { url } = await capturePhotoBlob(streamRef.current);
          const a = document.createElement('a');
          a.href = url;
          a.download = `CamLink-Photo-${Date.now()}.jpg`;
          a.click();
        }
        break;
      }
      case 'TRIGGER_ALARM': {
        playAlertSiren(3000);
        break;
      }
      case 'TOGGLE_NIGHT_VISION': {
        setSettings(s => ({ ...s, nightVision: !s.nightVision }));
        break;
      }
      default:
        break;
    }
  };

  /**
   * Local toggle torch
   */
  const handleToggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0] || null;
    const nextState = !settings.torch;
    await applyTorch(track, nextState);
    setSettings(s => ({ ...s, torch: nextState }));
  };

  /**
   * Local zoom adjustment
   */
  const handleZoomChange = async (val: number) => {
    const track = streamRef.current?.getVideoTracks()[0] || null;
    await applyZoom(track, val);
    setSettings(s => ({ ...s, zoom: val }));
  };

  /**
   * Switch front and rear cameras
   */
  const switchFacingMode = async (mode: 'user' | 'environment') => {
    if (!isSharing) {
      setSettings(s => ({ ...s, facingMode: mode }));
      return;
    }

    try {
      if (streamRef.current) {
        streamRef.current.getVideoTracks().forEach(t => t.stop());
      }
      const resConfig = RESOLUTION_PRESETS[settings.resolution];
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          ...resConfig,
        },
        audio: settings.audioEnabled,
      });

      const newVideoTrack = newStream.getVideoTracks()[0];
      if (newVideoTrack && webrtcManagerRef.current) {
        await webrtcManagerRef.current.replaceTrack(newVideoTrack);
      }

      streamRef.current = newStream;
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }

      const caps = extractCameraCapabilities(newVideoTrack);
      setCapabilities(caps);
      setSettings(s => ({
        ...s,
        facingMode: mode,
        torch: false,
        zoom: caps.zoomMin,
      }));
    } catch (err) {
      console.error('Failed to switch camera mode:', err);
    }
  };

  /**
   * Change resolution
   */
  const changeResolution = async (res: '4k' | '1080p' | '720p' | '480p') => {
    setSettings(s => ({ ...s, resolution: res }));
    if (!isSharing || !streamRef.current) return;

    try {
      const track = streamRef.current.getVideoTracks()[0];
      const preset = RESOLUTION_PRESETS[res];
      if (track) {
        await track.applyConstraints({
          width: preset.width,
          height: preset.height,
        });
      }
    } catch (err) {
      console.warn('Could not apply resolution constraints:', err);
    }
  };

  /**
   * Picture-in-Picture mode for background multitasking
   */
  const togglePictureInPicture = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (videoRef.current.requestPictureInPicture) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('Picture-in-Picture error:', err);
    }
  };

  /**
   * High-resolution photo snapshot
   */
  const handleTakeSnapshot = async () => {
    if (!streamRef.current) return;
    try {
      const { url } = await capturePhotoBlob(streamRef.current);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CamLink-Snapshot-${Date.now()}.jpg`;
      a.click();
    } catch (err) {
      console.error('Snapshot error:', err);
    }
  };

  /**
   * Motion detection loop
   */
  useEffect(() => {
    if (!settings.motionDetection || !isSharing) return;

    const interval = setInterval(() => {
      if (!videoRef.current || !motionCanvasRef.current) return;
      const video = videoRef.current;
      const canvas = motionCanvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx || video.videoWidth === 0) return;

      canvas.width = 160;
      canvas.height = 120;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const currentData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      if (lastFrameDataRef.current) {
        let diffPixels = 0;
        const totalPixels = currentData.data.length / 4;
        for (let i = 0; i < currentData.data.length; i += 4) {
          const rDiff = Math.abs(currentData.data[i] - lastFrameDataRef.current.data[i]);
          const gDiff = Math.abs(currentData.data[i + 1] - lastFrameDataRef.current.data[i + 1]);
          const bDiff = Math.abs(currentData.data[i + 2] - lastFrameDataRef.current.data[i + 2]);
          if (rDiff + gDiff + bDiff > 90) {
            diffPixels++;
          }
        }

        const motionRatio = diffPixels / totalPixels;
        if (motionRatio > 0.08) {
          setIsMotionTriggered(true);
          setMotionDetectedCount(c => c + 1);
          setTimeout(() => setIsMotionTriggered(false), 2000);
        }
      }
      lastFrameDataRef.current = currentData;
    }, 400);

    return () => clearInterval(interval);
  }, [settings.motionDetection, isSharing]);

  const copyUrlToClipboard = () => {
    navigator.clipboard.writeText(getPairingUrl());
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Remote Action Notification Toast */}
      {lastRemoteAction && (
        <div className="fixed top-20 right-4 z-50 flex items-center gap-2 rounded-xl bg-cyan-500 text-slate-950 font-bold px-4 py-2.5 shadow-2xl animate-in slide-in-from-top-2">
          <Activity className="w-4 h-4 animate-spin" />
          <span>Remote Command: {lastRemoteAction}</span>
        </div>
      )}

      {/* Hero / IP Pairing Broadcast Card */}
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 p-4 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
                <Radio className="w-5 h-5 animate-pulse" />
              </span>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Camera Broadcaster Node
                </h2>
                <p className="text-xs sm:text-sm text-slate-400">
                  Streams physical device camera with full hardware control access to connected Phones and PCs.
                </p>
              </div>
            </div>

            {/* Room ID and PIN controls */}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                <span className="text-slate-400">Room Code:</span>
                <span className="font-mono font-bold text-cyan-400 tracking-wider">
                  {roomId.toUpperCase()}
                </span>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-slate-400">PIN:</span>
                <input
                  type="text"
                  value={pin}
                  onChange={e => onRoomChange(roomId, e.target.value)}
                  placeholder="Optional PIN"
                  className="w-20 bg-transparent text-amber-300 font-mono focus:outline-none placeholder:text-slate-600"
                />
              </div>

              {wakeLockRef.current.isActive() && (
                <div className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>WakeLock: Screen Sleep Blocked (Running in Background)</span>
                </div>
              )}
            </div>
          </div>

          {/* Big Start / Stop Button */}
          <div className="flex items-center gap-3">
            {!isSharing ? (
              <button
                onClick={startCameraSharing}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm shadow-lg shadow-cyan-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
              >
                <Video className="w-4 h-4" />
                <span>Start Camera Sharing</span>
              </button>
            ) : (
              <button
                onClick={stopCameraSharing}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-lg shadow-rose-600/25 transition cursor-pointer"
              >
                <VideoOff className="w-4 h-4" />
                <span>Stop Sharing</span>
              </button>
            )}
          </div>
        </div>

        {/* IP Address and Direct Connect URL Box (Shown prominently when sharing starts!) */}
        {isSharing && (
          <div className="mt-5 pt-5 border-t border-slate-800 animate-in fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-xl bg-cyan-950/40 border border-cyan-800/60">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                    Live IP Pairing Address
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm sm:text-base font-mono font-bold text-white break-all">
                    {getPairingUrl()}
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  Enter this IP address or scan the QR code on another phone or PC to control this camera!
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={copyUrlToClipboard}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md transition cursor-pointer"
                >
                  {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedUrl ? 'Copied IP' : 'Copy IP Address'}</span>
                </button>

                <button
                  onClick={() => setShowQR(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs border border-slate-700 transition cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Show QR</span>
                </button>
              </div>
            </div>

            {/* Network Interfaces Selector if multiple IPs exist */}
            {networkInfo && networkInfo.localIps.length > 1 && (
              <div className="mt-2.5 flex items-center gap-2 text-xs text-slate-400 overflow-x-auto py-1">
                <span>Select IP Interface:</span>
                {networkInfo.localIps.map((ip, idx) => (
                  <button
                    key={ip.address}
                    onClick={() => setSelectedIpIndex(idx)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition ${
                      selectedIpIndex === idx
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {ip.iface}: {ip.address}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Broadcaster Grid: Live Viewport + Hardware Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Video Viewport */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative aspect-video rounded-2xl bg-black border border-slate-800 overflow-hidden shadow-2xl flex items-center justify-center group">
            {/* Live Video Element */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-contain ${
                settings.nightVision ? 'brightness-150 contrast-125 saturate-150 hue-rotate-15' : ''
              }`}
            />

            {/* Offline / Idle Placeholder */}
            {!isSharing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950/90 text-slate-400 space-y-3">
                <div className="p-4 rounded-full bg-slate-900 border border-slate-800 text-slate-600">
                  <Camera className="w-10 h-10" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-200">Camera Sharing Inactive</h3>
                  <p className="text-xs text-slate-400 max-w-sm mt-1">
                    Click "Start Camera Sharing" above to turn this device into an IP camera node.
                  </p>
                </div>
              </div>
            )}

            {/* HUD Overlay when active */}
            {isSharing && (
              <>
                {/* Top HUD info */}
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-xs pointer-events-none">
                  <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-white">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    <span className="font-bold uppercase tracking-wider text-[10px]">LIVE BROADCAST</span>
                    <span className="text-slate-400 font-mono">| {settings.resolution.toUpperCase()}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {settings.torch && (
                      <div className="flex items-center gap-1 bg-amber-500/80 text-black px-2.5 py-1 rounded-full font-bold text-[10px]">
                        <Zap className="w-3 h-3 fill-current" />
                        <span>TORCH ON</span>
                      </div>
                    )}
                    {settings.nightVision && (
                      <div className="flex items-center gap-1 bg-emerald-500/80 text-black px-2.5 py-1 rounded-full font-bold text-[10px]">
                        <Eye className="w-3 h-3" />
                        <span>NIGHT VISION</span>
                      </div>
                    )}
                    {isMotionTriggered && (
                      <div className="flex items-center gap-1 bg-rose-500 text-white px-2.5 py-1 rounded-full font-bold text-[10px] animate-bounce">
                        <AlertTriangle className="w-3 h-3" />
                        <span>MOTION DETECTED!</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom HUD quick overlay toolbar */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs bg-black/60 backdrop-blur-md p-2 rounded-xl border border-white/10">
                  <div className="flex items-center gap-2 text-white">
                    <button
                      onClick={togglePictureInPicture}
                      title="Run in Background via Picture-in-Picture"
                      className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition cursor-pointer"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleTakeSnapshot}
                      title="Take High-Res Photo"
                      className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => playAlertSiren(2000)}
                      title="Test Warning Siren"
                      className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-amber-400 transition cursor-pointer"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-slate-300 font-mono">
                    <span>Facing: {settings.facingMode}</span>
                    <span>Zoom: {settings.zoom.toFixed(1)}x</span>
                  </div>
                </div>
              </>
            )}

            {/* Hidden canvas for motion detection */}
            <canvas ref={motionCanvasRef} className="hidden" />
          </div>

          {/* Connected Viewers Bar */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">Connected Controllers:</span>
              <span className="font-bold text-white bg-slate-800 px-2 py-0.5 rounded">
                {activeViewers.length} active
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              <span>Allowing remote changes via IP</span>
            </div>
          </div>
        </div>

        {/* Right Column: Physical Camera Hardware Controls & Settings */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan-400" />
                <span>Physical Camera Settings</span>
              </h3>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">
                Hardware Access
              </span>
            </div>

            {/* Torch / Flashlight Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <Zap className={`w-3.5 h-3.5 ${settings.torch ? 'text-amber-400' : 'text-slate-500'}`} />
                  <span>Flashlight / Torch</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {capabilities.hasTorch
                    ? 'Hardware LED torch supported'
                    : 'Rear camera required for LED flash'}
                </p>
              </div>

              <button
                disabled={!isSharing}
                onClick={handleToggleTorch}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  settings.torch
                    ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                } disabled:opacity-50`}
              >
                {settings.torch ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Hardware Zoom Slider */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <ZoomIn className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Hardware Zoom</span>
                </span>
                <span className="font-mono text-cyan-400 font-bold">{settings.zoom.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min={capabilities.zoomMin || 1}
                max={capabilities.zoomMax > 1 ? capabilities.zoomMax : 5}
                step={capabilities.zoomStep || 0.1}
                value={settings.zoom}
                disabled={!isSharing}
                onChange={e => handleZoomChange(parseFloat(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer disabled:opacity-50"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>{capabilities.zoomMin || 1}x</span>
                <span>{capabilities.zoomMax > 1 ? capabilities.zoomMax : 5}x</span>
              </div>
            </div>

            {/* Camera Switcher (Front / Back / External) */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <SwitchCamera className="w-3.5 h-3.5 text-cyan-400" />
                <span>Lens Selection (Facing Mode)</span>
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => switchFacingMode('environment')}
                  className={`py-2 px-3 rounded-lg text-xs font-medium transition cursor-pointer ${
                    settings.facingMode === 'environment'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  Back (Environment)
                </button>
                <button
                  onClick={() => switchFacingMode('user')}
                  className={`py-2 px-3 rounded-lg text-xs font-medium transition cursor-pointer ${
                    settings.facingMode === 'user'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  Front (Selfie / Web)
                </button>
              </div>
            </div>

            {/* Resolution Switcher */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white">Stream Resolution</span>
                <span className="text-[11px] text-slate-400">Physical Camera Preset</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {(['4k', '1080p', '720p', '480p'] as const).map(res => (
                  <button
                    key={res}
                    onClick={() => changeResolution(res)}
                    className={`py-1.5 rounded-lg text-xs font-mono font-semibold uppercase transition cursor-pointer ${
                      settings.resolution === res
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {res}
                  </button>
                ))}
              </div>
            </div>

            {/* Night Vision & Motion Detection Smart Features */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSettings(s => ({ ...s, nightVision: !s.nightVision }))}
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  settings.nightVision
                    ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold mb-1">
                  <Eye className="w-3.5 h-3.5" />
                  <span>Night Vision</span>
                </div>
                <p className="text-[10px] text-slate-400">Boost low-light gain</p>
              </button>

              <button
                onClick={() => setSettings(s => ({ ...s, motionDetection: !s.motionDetection }))}
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  settings.motionDetection
                    ? 'bg-rose-950/40 border-rose-500/50 text-rose-300'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold mb-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Motion Guard</span>
                </div>
                <p className="text-[10px] text-slate-400">
                  {settings.motionDetection ? `${motionDetectedCount} alerts` : 'Detect movement'}
                </p>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* QR Code Modal for Phone-to-Phone / Phone-to-PC Pairing */}
      {showQR && (
        <QRCodeModal
          url={getPairingUrl()}
          roomId={roomId}
          pin={pin}
          onClose={() => setShowQR(false)}
        />
      )}
    </div>
  );
};
