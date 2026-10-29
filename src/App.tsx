/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Navbar, AppMode } from './components/Navbar';
import { BroadcasterView } from './components/BroadcasterView';
import { ControllerView } from './components/ControllerView';
import { DualIntercomView } from './components/DualIntercomView';
import { PackagingStudio } from './components/PackagingStudio';
import { WifiOff, Radio, Monitor, Download, RefreshCw, Shield, Sparkles } from 'lucide-react';

export default function App() {
  const [currentMode, setCurrentMode] = useState<AppMode>('broadcast');
  const [roomId, setRoomId] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('room') || Math.floor(100000 + Math.random() * 900000).toString();
  });
  const [pin, setPin] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('pin') || '';
  });
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Parse mode from URL query parameters (e.g. from QR code scan or IP address link)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get('mode') as AppMode;
    if (modeParam && ['broadcast', 'control', 'dual', 'package'].includes(modeParam)) {
      setCurrentMode(modeParam);
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRoomChange = (newRoomId: string, newPin: string) => {
    setRoomId(newRoomId);
    setPin(newPin);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Offline Alert Banner */}
      {!isOnline && (
        <div className="bg-amber-600 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-center gap-2">
          <WifiOff className="w-4 h-4" />
          <span>Offline Mode — Live IP camera streaming requires local network or WiFi connectivity.</span>
        </div>
      )}

      {/* Main Top Navigation */}
      <Navbar
        currentMode={currentMode}
        onSelectMode={setCurrentMode}
        isStreaming={false}
        connectedPeersCount={0}
      />

      {/* Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {currentMode === 'broadcast' && (
          <BroadcasterView
            roomId={roomId}
            pin={pin}
            onRoomChange={handleRoomChange}
          />
        )}

        {currentMode === 'control' && (
          <ControllerView
            roomId={roomId}
            pin={pin}
            onRoomChange={handleRoomChange}
          />
        )}

        {currentMode === 'dual' && (
          <DualIntercomView
            roomId={roomId}
            pin={pin}
          />
        )}

        {currentMode === 'package' && (
          <PackagingStudio />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-400">CamLink Pro</span>
            <span>&bull;</span>
            <span>High-Speed Cross-Platform IP Camera & Hardware Controller</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span>WebRTC Direct P2P & DataChannel</span>
            <span>&bull;</span>
            <span>Android .APK & Windows .EXE / .MSI Ready</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
