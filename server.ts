import express from 'express';
import http from 'http';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '25mb' }));

// In-memory room store for WebRTC signaling and remote commands
interface SignalMessage {
  id: string;
  senderId: string;
  senderType: 'camera' | 'controller';
  targetId?: string;
  type: 'offer' | 'answer' | 'candidate' | 'camera-settings' | 'camera-command' | 'status-update' | 'ping';
  data: any;
  timestamp: number;
}

interface Peer {
  id: string;
  type: 'camera' | 'controller';
  deviceName: string;
  platform: 'android' | 'ios' | 'windows' | 'mac' | 'linux' | 'other';
  lastSeen: number;
  sseResponse?: express.Response;
}

interface Room {
  id: string;
  pin: string;
  createdAt: number;
  cameraSettings?: any;
  peers: Map<string, Peer>;
  messageHistory: SignalMessage[];
}

const rooms = new Map<string, Room>();

// Clean up stale rooms every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [roomId, room] of rooms.entries()) {
    // If no peers active for 15 minutes, delete
    let hasActive = false;
    for (const [_, peer] of room.peers.entries()) {
      if (now - peer.lastSeen < 60000 * 5) {
        hasActive = true;
      }
    }
    if (!hasActive && now - room.createdAt > 60000 * 15) {
      rooms.delete(roomId);
    }
  }
}, 60000);

// Helper to get local IPv4 addresses
function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses: { iface: string; address: string; isPrivate: boolean }[] = [];

  for (const [name, netList] of Object.entries(interfaces)) {
    if (!netList) continue;
    for (const net of netList) {
      // IPv4 and non-internal (127.0.0.1)
      if (net.family === 'IPv4' && !net.internal) {
        const isPrivate =
          net.address.startsWith('192.168.') ||
          net.address.startsWith('10.') ||
          /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(net.address);
        addresses.push({
          iface: name,
          address: net.address,
          isPrivate,
        });
      }
    }
  }
  return addresses;
}

// 1. Network Info Endpoint
app.get('/api/network-info', (req, res) => {
  const localIps = getLocalIpAddresses();
  const hostHeader = req.get('host') || `localhost:${PORT}`;
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';
  const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';

  res.json({
    port: PORT,
    localIps,
    clientIp,
    protocol,
    hostHeader,
    currentUrl: `${protocol}://${hostHeader}`,
    suggestedUrls: localIps.map(ip => `${protocol}://${ip.address}:${PORT}`),
  });
});

// 2. Room Creation / Join
app.post('/api/signal/room', (req, res) => {
  const { roomId, pin } = req.body;
  const id = (roomId || Math.floor(100000 + Math.random() * 900000).toString()).toLowerCase();

  let room = rooms.get(id);
  if (!room) {
    room = {
      id,
      pin: pin || '',
      createdAt: Date.now(),
      peers: new Map(),
      messageHistory: [],
    };
    rooms.set(id, room);
  }

  res.json({
    roomId: id,
    pin: room.pin,
    peerCount: room.peers.size,
  });
});

// Register or Heartbeat Peer
app.post('/api/signal/room/:roomId/join', (req, res) => {
  const { roomId } = req.params;
  const { peerId, type, deviceName, platform, pin } = req.body;

  let room = rooms.get(roomId.toLowerCase());
  if (!room) {
    room = {
      id: roomId.toLowerCase(),
      pin: pin || '',
      createdAt: Date.now(),
      peers: new Map(),
      messageHistory: [],
    };
    rooms.set(room.id, room);
  }

  // Check pin if set and not camera
  if (room.pin && pin && room.pin !== pin && type !== 'camera') {
    return res.status(403).json({ error: 'Invalid security PIN' });
  }

  const existing = room.peers.get(peerId);
  room.peers.set(peerId, {
    id: peerId,
    type: type || 'controller',
    deviceName: deviceName || 'Unknown Device',
    platform: platform || 'other',
    lastSeen: Date.now(),
    sseResponse: existing?.sseResponse,
  });

  res.json({
    success: true,
    roomId: room.id,
    cameraSettings: room.cameraSettings,
    peers: Array.from(room.peers.values()).map(p => ({
      id: p.id,
      type: p.type,
      deviceName: p.deviceName,
      platform: p.platform,
      lastSeen: p.lastSeen,
    })),
  });
});

// Send WebRTC Signal or Camera Command
app.post('/api/signal/room/:roomId/message', (req, res) => {
  const { roomId } = req.params;
  const { senderId, senderType, targetId, type, data } = req.body;

  const room = rooms.get(roomId.toLowerCase());
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  const message: SignalMessage = {
    id: Math.random().toString(36).substring(2, 9),
    senderId,
    senderType: senderType || 'camera',
    targetId,
    type,
    data,
    timestamp: Date.now(),
  };

  if (type === 'camera-settings' && data) {
    room.cameraSettings = data;
  }

  // Retain short history
  room.messageHistory.push(message);
  if (room.messageHistory.length > 100) {
    room.messageHistory.shift();
  }

  // Push to SSE listeners
  for (const [pId, peer] of room.peers.entries()) {
    if (pId !== senderId && (!targetId || targetId === pId) && peer.sseResponse) {
      try {
        peer.sseResponse.write(`data: ${JSON.stringify(message)}\n\n`);
      } catch (err) {
        console.error('SSE send error', err);
      }
    }
  }

  res.json({ success: true, messageId: message.id });
});

// Server-Sent Events stream for real-time signaling & controls
app.get('/api/signal/events/:roomId/:peerId', (req, res) => {
  const { roomId, peerId } = req.params;
  const room = rooms.get(roomId.toLowerCase());

  if (!room) {
    return res.status(404).send('Room not found');
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  let peer = room.peers.get(peerId);
  if (!peer) {
    peer = {
      id: peerId,
      type: 'controller',
      deviceName: 'Device',
      platform: 'other',
      lastSeen: Date.now(),
    };
    room.peers.set(peerId, peer);
  }

  peer.sseResponse = res;
  peer.lastSeen = Date.now();

  // Send initial handshake ping
  res.write(`data: ${JSON.stringify({ type: 'connected', roomId, peerId })}\n\n`);

  // Send current camera settings if available
  if (room.cameraSettings) {
    res.write(`data: ${JSON.stringify({ type: 'camera-settings', data: room.cameraSettings })}\n\n`);
  }

  const keepAliveInterval = setInterval(() => {
    try {
      res.write(': keep-alive\n\n');
      if (peer) peer.lastSeen = Date.now();
    } catch {
      clearInterval(keepAliveInterval);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(keepAliveInterval);
    if (peer && peer.sseResponse === res) {
      peer.sseResponse = undefined;
    }
  });
});

// Fallback Poll Endpoint
app.get('/api/signal/room/:roomId/poll', (req, res) => {
  const { roomId } = req.params;
  const since = Number(req.query.since) || 0;
  const peerId = (req.query.peerId as string) || '';

  const room = rooms.get(roomId.toLowerCase());
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  if (peerId && room.peers.has(peerId)) {
    const peer = room.peers.get(peerId)!;
    peer.lastSeen = Date.now();
  }

  const messages = room.messageHistory.filter(
    m => m.timestamp > since && m.senderId !== peerId && (!m.targetId || m.targetId === peerId)
  );

  res.json({
    messages,
    now: Date.now(),
    cameraSettings: room.cameraSettings,
  });
});

// Export Packaging Guides, Manifests, & Configurations
app.get('/api/package-spec/:platform', (req, res) => {
  const { platform } = req.params;
  const host = req.get('host') || 'localhost:3000';
  const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
  const appUrl = `${protocol}://${host}`;

  if (platform === 'android') {
    res.json({
      platform: 'Android (.APK / .AAB for Google Play Store)',
      packageName: 'com.camlinkpro.app',
      appName: 'CamLink Pro',
      version: '1.0.0',
      versionCode: 1,
      minSdkVersion: 24,
      targetSdkVersion: 34,
      permissions: [
        'android.permission.CAMERA',
        'android.permission.FLASHLIGHT',
        'android.permission.RECORD_AUDIO',
        'android.permission.MODIFY_AUDIO_SETTINGS',
        'android.permission.INTERNET',
        'android.permission.ACCESS_NETWORK_STATE',
        'android.permission.ACCESS_WIFI_STATE',
        'android.permission.WAKE_LOCK',
        'android.permission.FOREGROUND_SERVICE',
        'android.permission.FOREGROUND_SERVICE_CAMERA',
      ],
      manifestSnippet: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.camlinkpro.app">

    <uses-feature android:name="android.hardware.camera" android:required="true" />
    <uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />
    <uses-feature android:name="android.hardware.camera.flash" android:required="false" />

    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.FLASHLIGHT" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_CAMERA" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="CamLink Pro"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme"
        android:usesCleartextTraffic="true">
        <activity
            android:name=".MainActivity"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"
            android:exported="true"
            android:launchMode="singleTask"
            android:screenOrientation="sensor">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>`,
      capacitorConfig: {
        appId: 'com.camlinkpro.app',
        appName: 'CamLink Pro',
        webDir: 'dist',
        server: {
          androidScheme: 'https',
          cleartext: true,
          url: appUrl,
        },
        android: {
          allowMixedContent: true,
        },
      },
      cliCommands: [
        'npm install @capacitor/core @capacitor/cli @capacitor/android',
        'npx cap init "CamLink Pro" "com.camlinkpro.app" --web-dir dist',
        'npx cap add android',
        'npx cap sync android',
        'npx cap open android  # Opens Android Studio -> Build -> Generate Signed APK / Bundle (.aab for Play Store)',
      ],
      twaBubblewrapCommands: [
        'npm install -g @bubblewrap/cli',
        `bubblewrap init --manifest=${appUrl}/manifest.webmanifest`,
        'bubblewrap build  # Outputs app-release-signed.apk and .aab for Google Play Store',
      ],
    });
  } else {
    // Windows PC
    res.json({
      platform: 'Windows PC (.EXE and .MSI for Microsoft Store & Direct Setup)',
      appName: 'CamLink Pro',
      version: '1.0.0',
      appId: 'com.camlinkpro.pc',
      storeIdentity: {
        publisher: 'CN=CamLinkProDeveloper',
        publisherDisplayName: 'CamLink Pro Team',
        name: 'CamLinkPro.CameraHub',
      },
      electronBuilderConfig: {
        appId: 'com.camlinkpro.pc',
        productName: 'CamLink Pro',
        directories: {
          output: 'build-pc',
        },
        win: {
          target: ['nsis', 'msi', 'appx'],
          icon: 'public/icon.ico',
        },
        nsis: {
          oneClick: false,
          perMachine: true,
          allowToChangeInstallationDirectory: true,
          createDesktopShortcut: true,
          artifactName: 'CamLink-Pro-Setup-${version}.${ext}', // Generates .exe
        },
        msi: {
          oneClick: false,
          perMachine: true,
          artifactName: 'CamLink-Pro-Installer-${version}.${ext}', // Generates .msi
        },
        appx: {
          identityName: 'CamLinkPro.CameraHub',
          publisherDisplayName: 'CamLink Pro',
          publisher: 'CN=YOUR-MICROSOFT-STORE-PUBLISHER-ID',
          applicationId: 'CamLinkPro',
        },
      },
      cliCommands: [
        'npm install -D electron electron-builder',
        'npm run build',
        'npx electron-builder --win nsis msi appx',
        '# Resulting files in build-pc/ directory:',
        '# -> CamLink-Pro-Setup-1.0.0.exe (Standalone executable installer)',
        '# -> CamLink-Pro-Installer-1.0.0.msi (Windows Installer Package)',
        '# -> CamLink-Pro-1.0.0.msix / .appx (Microsoft Store Package ready for Partner Center upload)',
      ],
      pwaBuilderMethod: [
        '1. Open https://www.pwabuilder.com',
        `2. Enter your app URL: ${appUrl}`,
        '3. Click "Store Packages" -> "Windows"',
        '4. Download the generated Windows Package (.msix / .msixbundle) signed for Microsoft Store!',
      ],
    });
  }
});

// Serve direct package downloads (.apk, .exe, .msi)
const ARTIFACT_DIR = '/.aistudio/artifacts/brain/640130b7-63ff-494e-9c56-40ebdfaad129';
const PUBLIC_DOWNLOADS = path.resolve(__dirname, 'public/downloads');

app.get('/api/download/:type', (req, res) => {
  const { type } = req.params;
  let filename = '';
  if (type === 'apk') filename = 'CamLinkPro-Release.apk';
  else if (type === 'exe') filename = 'CamLinkPro-Setup.exe';
  else if (type === 'msi') filename = 'CamLinkPro-Installer.msi';
  else return res.status(404).json({ error: 'Unknown file type' });

  const artifactPath = path.join(ARTIFACT_DIR, filename);
  const publicPath = path.join(PUBLIC_DOWNLOADS, filename);

  const filePath = fs.existsSync(artifactPath) ? artifactPath : publicPath;
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Package file not found' });
  }

  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.download(filePath, filename);
});

// Mount Vite or serve static dist
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[CamLink Pro] Server online at http://0.0.0.0:${PORT}`);
    const ips = getLocalIpAddresses();
    ips.forEach(ip => {
      console.log(`[CamLink Pro] Local Network IP (${ip.iface}): http://${ip.address}:${PORT}`);
    });
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
