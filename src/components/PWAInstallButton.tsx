import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, Laptop, X, CheckCircle } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
        <CheckCircle className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Installed as Native App</span>
        <span className="sm:hidden">Installed</span>
      </div>
    );
  }

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-cyan-500/20 hover:from-cyan-400 hover:to-blue-500 transition-all active:scale-95 cursor-pointer"
        title="Install CamLink Pro on this device"
      >
        <Download className="w-3.5 h-3.5 animate-bounce" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition active:scale-95 cursor-pointer"
        >
          <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
          <span>Install iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-base font-semibold text-white">Install on iPhone / iPad</h3>
                </div>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed mb-4">
                To install CamLink Pro as a full-screen native camera app with background capabilities:
              </p>
              <div className="space-y-2.5 text-xs text-slate-300 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-cyan-400 bg-cyan-950/80 px-1.5 py-0.5 rounded">1</span>
                  <span>Tap the <strong>Share</strong> button (box with up arrow) in Safari toolbar.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-cyan-400 bg-cyan-950/80 px-1.5 py-0.5 rounded">2</span>
                  <span>Scroll down and tap <strong>Add to Home Screen</strong>.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-cyan-400 bg-cyan-950/80 px-1.5 py-0.5 rounded">3</span>
                  <span>Tap <strong>Add</strong> in the top-right corner.</span>
                </div>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-cyan-500 py-2.5 text-xs font-semibold text-slate-950 hover:bg-cyan-400 transition"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
