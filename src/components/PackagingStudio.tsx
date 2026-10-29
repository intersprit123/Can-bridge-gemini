import React, { useEffect, useState } from 'react';
import {
  Download,
  Smartphone,
  Monitor,
  Copy,
  Check,
  Package,
  Layers,
  FileCode,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Terminal,
} from 'lucide-react';

export const PackagingStudio: React.FC = () => {
  const [androidSpec, setAndroidSpec] = useState<any>(null);
  const [windowsSpec, setWindowsSpec] = useState<any>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/package-spec/android')
      .then(r => r.json())
      .then(setAndroidSpec)
      .catch(console.error);

    fetch('/api/package-spec/windows')
      .then(r => r.json())
      .then(setWindowsSpec)
      .catch(console.error);
  }, []);

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const downloadFile = (content: string, filename: string, mime = 'text/plain') => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Hero Header */}
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Export & Store Packaging Studio
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Ready-to-deploy release artifacts for Google Play Store (.APK) and Microsoft Store / PC (.EXE & .MSI).
            </p>
          </div>
        </div>

        {/* Live Built Artifacts Showcase */}
        <div className="mt-6 pt-5 border-t border-slate-800">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Generated Distribution Artifacts (Ready for Download)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 1. Android APK */}
            <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/60 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-900/80 text-emerald-300 border border-emerald-700">
                    ANDROID
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">.APK</span>
                </div>
                <h4 className="font-bold text-white text-sm mt-2">CamLinkPro-Release.apk</h4>
                <p className="text-[11px] text-slate-300 mt-1">
                  Google Play Store & Android phone sideload package with camera & background streaming service.
                </p>
              </div>
              <a
                href="/api/download/apk"
                download="CamLinkPro-Release.apk"
                className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .APK</span>
              </a>
            </div>

            {/* 2. Windows EXE */}
            <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-800/60 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-900/80 text-blue-300 border border-blue-700">
                    WINDOWS PC
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">.EXE</span>
                </div>
                <h4 className="font-bold text-white text-sm mt-2">CamLinkPro-Setup.exe</h4>
                <p className="text-[11px] text-slate-300 mt-1">
                  Standalone desktop installer for Windows 10 & 11 with tray icon and multi-camera support.
                </p>
              </div>
              <a
                href="/api/download/exe"
                download="CamLinkPro-Setup.exe"
                className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .EXE</span>
              </a>
            </div>

            {/* 3. Windows MSI */}
            <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-800/60 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-900/80 text-indigo-300 border border-indigo-700">
                    STORE & ENTERPRISE
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">.MSI</span>
                </div>
                <h4 className="font-bold text-white text-sm mt-2">CamLinkPro-Installer.msi</h4>
                <p className="text-[11px] text-slate-300 mt-1">
                  Microsoft Store & Windows Installer package for Partner Center and enterprise deployment.
                </p>
              </div>
              <a
                href="/api/download/msi"
                download="CamLinkPro-Installer.msi"
                className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-500/20 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .MSI</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Android / Phone (.APK & .AAB for Google Play Store) */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-6 shadow-xl">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Android Application</h3>
                <p className="text-xs text-slate-400">.APK & .AAB (Google Play Store)</p>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300">
              API Level 24+
            </span>
          </div>

          <div className="space-y-4">
            <p className="text-xs text-slate-300 leading-relaxed">
              CamLink Pro is fully compliant with modern Android camera requirements:
              Hardware camera permissions, LED Flashlight control, Screen WakeLock, and Foreground Camera Service
              for continuous background streaming.
            </p>

            {/* Quick 1-Click PWABuilder Android APK */}
            <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>One-Click Cloud APK Generator</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Generate signed .APK & .AAB in 1 click using PWABuilder (maintained by Microsoft & Google):
              </p>
              <a
                href={`https://www.pwabuilder.com`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition mt-1"
              >
                <span>Open PWABuilder for Android APK</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Manifest & Config Downloads */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-200">
                Android Studio / Capacitor Project Files:
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() =>
                    downloadFile(
                      androidSpec?.manifestSnippet || '',
                      'AndroidManifest.xml',
                      'application/xml'
                    )
                  }
                  className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:bg-slate-800 text-xs text-slate-200 flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                  <span>AndroidManifest.xml</span>
                </button>

                <button
                  onClick={() =>
                    downloadFile(
                      JSON.stringify(androidSpec?.capacitorConfig || {}, null, 2),
                      'capacitor.config.json',
                      'application/json'
                    )
                  }
                  className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:bg-slate-800 text-xs text-slate-200 flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                  <span>capacitor.config.json</span>
                </button>
              </div>
            </div>

            {/* CLI Build Instructions */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-semibold text-slate-300 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Capacitor CLI Build Commands:</span>
                </span>
                <button
                  onClick={() =>
                    copyText(
                      (androidSpec?.cliCommands || []).join('\n'),
                      'android-cli'
                    )
                  }
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                >
                  {copiedSection === 'android-cli' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedSection === 'android-cli' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="text-[11px] font-mono text-emerald-400/90 whitespace-pre-wrap leading-relaxed overflow-x-auto p-2 bg-black rounded-lg">
                {(androidSpec?.cliCommands || []).join('\n')}
              </pre>
            </div>
          </div>
        </div>

        {/* Windows PC (.EXE, .MSI, and .MSIX for Microsoft Store) */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-6 shadow-xl">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                <Monitor className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Windows PC Application</h3>
                <p className="text-xs text-slate-400">.EXE, .MSI & Microsoft Store</p>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-950 border border-blue-800 text-blue-300">
              Win 10 / 11
            </span>
          </div>

          <div className="space-y-4">
            <p className="text-xs text-slate-300 leading-relaxed">
              CamLink Pro packages natively into standalone Windows Executables (<strong>.EXE</strong> via NSIS),
              Enterprise Windows Installers (<strong>.MSI</strong> via WiX), and Microsoft Store App Packages (<strong>.MSIX</strong>).
            </p>

            {/* Quick 1-Click PWABuilder Microsoft Store Package */}
            <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-800/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Microsoft Store Package Builder</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Generate a ready-to-upload Microsoft Store package (.msix / .msixbundle):
              </p>
              <a
                href="https://www.pwabuilder.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition mt-1"
              >
                <span>Generate Windows MSIX on PWABuilder</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Electron Builder Config & Inno Setup Downloads */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-200">
                Windows .EXE and .MSI Installer Configurations:
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() =>
                    downloadFile(
                      JSON.stringify(windowsSpec?.electronBuilderConfig || {}, null, 2),
                      'electron-builder.json',
                      'application/json'
                    )
                  }
                  className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:bg-slate-800 text-xs text-slate-200 flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <FileCode className="w-3.5 h-3.5 text-blue-400" />
                  <span>electron-builder.json (.EXE / .MSI)</span>
                </button>

                <button
                  onClick={() => {
                    const issScript = `; Inno Setup Script for CamLink Pro .EXE Installer
[Setup]
AppName=CamLink Pro
AppVersion=1.0.0
DefaultDirName={autopf}\\CamLink Pro
DefaultGroupName=CamLink Pro
OutputBaseFilename=CamLink-Pro-Setup-1.0.0
Compression=lzma
SolidCompression=yes
OutputDir=build-pc

[Files]
Source: "dist\\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs

[Icons]
Name: "{group}\\CamLink Pro"; Filename: "{app}\\CamLink Pro.exe"
Name: "{autodesktop}\\CamLink Pro"; Filename: "{app}\\CamLink Pro.exe"
`;
                    downloadFile(issScript, 'setup.iss', 'text/plain');
                  }}
                  className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:bg-slate-800 text-xs text-slate-200 flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <FileCode className="w-3.5 h-3.5 text-amber-400" />
                  <span>setup.iss (Inno Setup .EXE)</span>
                </button>
              </div>
            </div>

            {/* CLI Build Instructions */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-semibold text-slate-300 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-blue-400" />
                  <span>Windows .EXE & .MSI Build Commands:</span>
                </span>
                <button
                  onClick={() =>
                    copyText(
                      (windowsSpec?.cliCommands || []).join('\n'),
                      'windows-cli'
                    )
                  }
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                >
                  {copiedSection === 'windows-cli' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedSection === 'windows-cli' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="text-[11px] font-mono text-cyan-400/90 whitespace-pre-wrap leading-relaxed overflow-x-auto p-2 bg-black rounded-lg">
                {(windowsSpec?.cliCommands || []).join('\n')}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
