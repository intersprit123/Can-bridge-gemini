import React, { useEffect, useRef, useState } from 'react';
import {
  RefreshCw,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Zap,
  ZoomIn,
  SwitchCamera,
  Camera,
  Volume2,
  VolumeX,
  Radio,
  Sliders,
  Shield,
  Monitor,
  Smartphone,
} from 'lucide-react';
import { applyTorch, applyZoom, extractCameraCapabilities, playAlertSiren } from '../utils/cameraControls';
import { WebRTCManager } from '../utils/webrtc';
import { RemoteCommand } from '../types/camera';

interface DualIntercomViewProps {
  roomId: string;
  pin: string;
}

export const DualIntercomView: React.FC<DualIntercomViewProps> = ({ roomId, pin }) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const webrtcRef = useRef<WebRTCManager | null>(null);

  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [remoteTorch, setRemoteTorch] = useState(false);
  const [remoteZoom, setRemoteZoom] = useState(1);
  const [localTorch, setLocalTorch] = useState(false);
  const [localZoom, setLocalZoom] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  const startDualCall = async () => {
    setIsConnecting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: true,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play();
      }

      const myPeerId = `dual-${Math.random().toString(36).substring(2, 7)}`;
      const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);

      await fetch(`/api/signal/room/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          peerId: myPeerId,
          type: 'camera',
          deviceName: isMobile ? 'Dual Intercom Phone' : 'Dual Intercom PC',
          platform: isMobile ? 'android' : 'windows',
          pin,
        }),
      });

      const webrtc = new WebRTCManager({
        roomId,
        peerId: myPeerId,
        isBroadcaster: true,
        localStream: stream,
        onRemoteStream: (rStream) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = rStream;
            remoteVideoRef.current.play().catch(console.warn);
          }
        },
        onCommandReceived: async (cmd: RemoteCommand) => {
          const track = localStreamRef.current?.getVideoTracks()[0] || null;
          if (cmd.type === 'SET_TORCH') {
            await applyTorch(track, !!cmd.payload);
            setLocalTorch(!!cmd.payload);
          }
          if (cmd.type === 'SET_ZOOM') {
            await applyZoom(track, Number(cmd.payload));
            setLocalZoom(Number(cmd.payload));
          }
        },
      });

      await webrtc.start();
      webrtcRef.current = webrtc;
      setIsActive(true);
    } catch (err) {
      console.error('Failed to start dual session:', err);
      alert('Could not start camera & microphone for Dual Intercom.');
    } finally {
      setIsConnecting(false);
    }
  };

  const endDualCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (webrtcRef.current) {
      webrtcRef.current.destroy();
      webrtcRef.current = null;
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    setIsActive(false);
  };

  const sendRemoteCmd = (type: any, payload?: any) => {
    if (!webrtcRef.current) return;
    webrtcRef.current.sendCommand({
      type,
      payload,
      timestamp: Date.now(),
      senderName: 'Dual Intercom Partner',
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-indigo-400" />
            <span>Dual Two-Way Intercom & Mutual Camera Control</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Simultaneously share and control both cameras with bidirectional audio between Phone & PC.
          </p>
        </div>

        <div>
          {!isActive ? (
            <button
              onClick={startDualCall}
              disabled={isConnecting}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
            >
              {isConnecting ? 'Starting...' : 'Start Dual Session'}
            </button>
          ) : (
            <button
              onClick={endDualCall}
              className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
            >
              End Call
            </button>
          )}
        </div>
      </div>

      {/* Main Dual Video Canvas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Remote Camera Frame */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3 space-y-3 shadow-xl">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span className="flex items-center gap-1.5">
              <Monitor className="w-3.5 h-3.5 text-indigo-400" />
              <span>Partner Device Camera</span>
            </span>
            <span className="text-[10px] text-emerald-400 font-mono">LIVE FEED</span>
          </div>

          <div className="relative aspect-video rounded-xl bg-black overflow-hidden flex items-center justify-center border border-slate-800">
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-contain" />
            {!isActive && (
              <div className="text-xs text-slate-500 text-center p-4">
                Waiting to connect with second device...
              </div>
            )}
          </div>

          {/* Remote Hardware Controls */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-900">
            <button
              disabled={!isActive}
              onClick={() => {
                const next = !remoteTorch;
                setRemoteTorch(next);
                sendRemoteCmd('SET_TORCH', next);
              }}
              className="py-2 px-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white hover:bg-slate-800 flex items-center justify-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>{remoteTorch ? 'Turn Partner Torch OFF' : 'Turn Partner Torch ON'}</span>
            </button>

            <button
              disabled={!isActive}
              onClick={() => sendRemoteCmd('SWITCH_CAMERA')}
              className="py-2 px-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white hover:bg-slate-800 flex items-center justify-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
            >
              <SwitchCamera className="w-3.5 h-3.5 text-cyan-400" />
              <span>Flip Partner Lens</span>
            </button>
          </div>
        </div>

        {/* Local Camera Frame */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3 space-y-3 shadow-xl">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span className="flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
              <span>This Device's Camera</span>
            </span>
            <span className="text-[10px] text-cyan-400 font-mono">BROADCASTING</span>
          </div>

          <div className="relative aspect-video rounded-xl bg-black overflow-hidden flex items-center justify-center border border-slate-800">
            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-contain" />
            {!isActive && (
              <div className="text-xs text-slate-500 text-center p-4">
                Local camera preview will show here
              </div>
            )}
          </div>

          {/* Local Controls */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-900">
            <button
              disabled={!isActive}
              onClick={async () => {
                const track = localStreamRef.current?.getVideoTracks()[0] || null;
                const next = !localTorch;
                await applyTorch(track, next);
                setLocalTorch(next);
              }}
              className="py-2 px-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white hover:bg-slate-800 flex items-center justify-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>{localTorch ? 'My Torch: ON' : 'My Torch: OFF'}</span>
            </button>

            <button
              disabled={!isActive}
              onClick={() => {
                const audioTrack = localStreamRef.current?.getAudioTracks()[0];
                if (audioTrack) {
                  audioTrack.enabled = !audioTrack.enabled;
                  setIsMuted(!audioTrack.enabled);
                }
              }}
              className="py-2 px-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white hover:bg-slate-800 flex items-center justify-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
            >
              {isMuted ? <MicOff className="w-3.5 h-3.5 text-rose-400" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
              <span>{isMuted ? 'Muted' : 'Mic Active'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
