import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode, X, Copy, Check, ExternalLink } from 'lucide-react';

interface QRCodeModalProps {
  url: string;
  roomId: string;
  pin: string;
  onClose: () => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({ url, roomId, pin, onClose }) => {
  const [qrSrc, setQrSrc] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    QRCode.toDataURL(url, {
      width: 320,
      margin: 2,
      color: {
        dark: '#030712',
        light: '#ffffff',
      },
    }).then(setQrSrc).catch(console.error);
  }, [url]);

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Scan to Connect</h3>
              <p className="text-xs text-slate-400">Point phone camera to pair instantly</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* QR Code Container */}
        <div className="my-5 flex flex-col items-center justify-center">
          <div className="p-3.5 bg-white rounded-2xl shadow-xl shadow-cyan-500/10 border-4 border-slate-700/50">
            {qrSrc ? (
              <img src={qrSrc} alt="Camera Connect QR Code" className="w-56 h-56 rounded-lg" />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center text-slate-600 text-xs">
                Generating QR...
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center gap-3 text-xs">
            <span className="text-slate-400">Room Code:</span>
            <span className="font-mono font-bold tracking-wider text-cyan-400 bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800">
              {roomId.toUpperCase()}
            </span>
            {pin && (
              <>
                <span className="text-slate-400">PIN:</span>
                <span className="font-mono font-bold text-amber-400 bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800">
                  {pin}
                </span>
              </>
            )}
          </div>
        </div>

        {/* URL Card with 1-click Copy */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-slate-300">
            <span className="truncate">{url}</span>
            <button
              onClick={handleCopy}
              className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-semibold text-xs transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
