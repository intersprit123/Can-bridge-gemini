import React from 'react';
import { Camera, Radio, Smartphone, Monitor, Download, ShieldCheck, Wifi, Sparkles, RefreshCw } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

export type AppMode = 'broadcast' | 'control' | 'dual' | 'package';

interface NavbarProps {
  currentMode: AppMode;
  onSelectMode: (mode: AppMode) => void;
  isStreaming: boolean;
  connectedPeersCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentMode,
  onSelectMode,
  isStreaming,
  connectedPeersCount,
}) => {
  const isMobile = typeof navigator !== 'undefined' && /android|iphone|ipad|ipod/i.test(navigator.userAgent);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 shadow-lg shadow-cyan-500/20 text-white">
            <Camera className="w-5 h-5" />
            {isStreaming && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white tracking-tight text-sm sm:text-base">CamLink Pro</span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300">
                Cross-Platform IP Cam
              </span>
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <span>{isMobile ? 'Mobile Phone' : 'Desktop / PC'}</span>
              <span className="inline-block w-1 h-1 rounded-full bg-slate-600" />
              {isStreaming ? (
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live ({connectedPeersCount} viewer{connectedPeersCount === 1 ? '' : 's'})
                </span>
              ) : (
                <span className="text-slate-400">Ready</span>
              )}
            </p>
          </div>
        </div>

        {/* Mode Tabs */}
        <nav className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs overflow-x-auto scrollbar-none max-w-full">
          <button
            onClick={() => onSelectMode('broadcast')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer whitespace-nowrap ${
              currentMode === 'broadcast'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Share Camera</span>
          </button>

          <button
            onClick={() => onSelectMode('control')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer whitespace-nowrap ${
              currentMode === 'control'
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Remote Control</span>
          </button>

          <button
            onClick={() => onSelectMode('dual')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer whitespace-nowrap ${
              currentMode === 'dual'
                ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Dual Intercom</span>
          </button>

          <button
            onClick={() => onSelectMode('package')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer whitespace-nowrap ${
              currentMode === 'package'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Store & APK/MSI</span>
          </button>
        </nav>

        {/* Right side Actions */}
        <div className="flex items-center gap-2">
          <PWAInstallButton />
        </div>
      </div>
    </header>
  );
};
