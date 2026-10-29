import { CameraCapabilities, CameraCurrentSettings } from '../types/camera';

// Resolution constraints
export const RESOLUTION_PRESETS = {
  '4k': { width: { ideal: 3840 }, height: { ideal: 2160 } },
  '1080p': { width: { ideal: 1920 }, height: { ideal: 1080 } },
  '720p': { width: { ideal: 1280 }, height: { ideal: 720 } },
  '480p': { width: { ideal: 640 }, height: { ideal: 480 } },
};

/**
 * Inspect video track for hardware camera capabilities
 */
export function extractCameraCapabilities(track: MediaStreamTrack | null): CameraCapabilities {
  const caps: CameraCapabilities = {
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
  };

  if (!track || typeof track.getCapabilities !== 'function') {
    return caps;
  }

  try {
    const trackCaps: any = track.getCapabilities();

    if ('torch' in trackCaps) {
      caps.hasTorch = !!trackCaps.torch;
    }

    if ('zoom' in trackCaps) {
      caps.hasZoom = true;
      caps.zoomMin = trackCaps.zoom?.min ?? 1;
      caps.zoomMax = trackCaps.zoom?.max ?? 5;
      caps.zoomStep = trackCaps.zoom?.step ?? 0.1;
    }

    if ('exposureCompensation' in trackCaps) {
      caps.hasExposureCompensation = true;
      caps.exposureMin = trackCaps.exposureCompensation?.min ?? -2;
      caps.exposureMax = trackCaps.exposureCompensation?.max ?? 2;
      caps.exposureStep = trackCaps.exposureCompensation?.step ?? 0.5;
    }

    if ('whiteBalanceMode' in trackCaps) {
      caps.hasWhiteBalance = true;
    }

    if ('focusMode' in trackCaps) {
      caps.hasFocusMode = true;
    }

    if (trackCaps.width?.max) {
      caps.widthMax = trackCaps.width.max;
    }
    if (trackCaps.height?.max) {
      caps.heightMax = trackCaps.height.max;
    }
  } catch (err) {
    console.warn('Error reading camera capabilities:', err);
  }

  return caps;
}

/**
 * Apply hardware torch (flashlight) to a video track
 */
export async function applyTorch(track: MediaStreamTrack | null, enable: boolean): Promise<boolean> {
  if (!track || typeof track.applyConstraints !== 'function') return false;

  try {
    const advancedConstraints: any = [{ torch: enable }];
    await track.applyConstraints({
      advanced: advancedConstraints,
    });
    return true;
  } catch (err) {
    console.warn('Could not apply torch constraint:', err);
    return false;
  }
}

/**
 * Apply hardware zoom level
 */
export async function applyZoom(track: MediaStreamTrack | null, zoomLevel: number): Promise<boolean> {
  if (!track || typeof track.applyConstraints !== 'function') return false;

  try {
    const advancedConstraints: any = [{ zoom: zoomLevel }];
    await track.applyConstraints({
      advanced: advancedConstraints,
    });
    return true;
  } catch (err) {
    console.warn('Could not apply zoom constraint:', err);
    return false;
  }
}

/**
 * Apply exposure compensation
 */
export async function applyExposure(track: MediaStreamTrack | null, value: number): Promise<boolean> {
  if (!track || typeof track.applyConstraints !== 'function') return false;

  try {
    const advancedConstraints: any = [{ exposureCompensation: value }];
    await track.applyConstraints({
      advanced: advancedConstraints,
    });
    return true;
  } catch (err) {
    console.warn('Could not apply exposure compensation:', err);
    return false;
  }
}

/**
 * High-resolution photo snapshot capture using ImageCapture API with canvas fallback
 */
export async function capturePhotoBlob(stream: MediaStream): Promise<{ blob: Blob; url: string }> {
  const videoTrack = stream.getVideoTracks()[0];
  if (!videoTrack) {
    throw new Error('No active video track');
  }

  // Try native ImageCapture API first (delivers full sensor resolution on phones!)
  if ('ImageCapture' in window) {
    try {
      const imageCapture = new (window as any).ImageCapture(videoTrack);
      const photoBlob: Blob = await imageCapture.takePhoto();
      return {
        blob: photoBlob,
        url: URL.createObjectURL(photoBlob),
      };
    } catch (err) {
      console.warn('ImageCapture.takePhoto failed, falling back to canvas grab:', err);
    }
  }

  // Canvas fallback
  const video = document.createElement('video');
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 1920;
  canvas.height = video.videoHeight || 1080;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve({
          blob,
          url: URL.createObjectURL(blob),
        });
      } else {
        reject(new Error('Canvas blob generation failed'));
      }
    }, 'image/jpeg', 0.95);
  });
}

/**
 * Screen WakeLock API to keep device awake and camera broadcasting in background
 */
export class WakeLockManager {
  private sentinel: any = null;

  async request(): Promise<boolean> {
    if ('wakeLock' in navigator) {
      try {
        this.sentinel = await (navigator as any).wakeLock.request('screen');
        this.sentinel.addEventListener('release', () => {
          this.sentinel = null;
        });
        return true;
      } catch (err) {
        console.warn('Wake Lock request failed:', err);
        return false;
      }
    }
    return false;
  }

  release() {
    if (this.sentinel) {
      this.sentinel.release().catch(() => {});
      this.sentinel = null;
    }
  }

  isActive(): boolean {
    return this.sentinel !== null;
  }
}

/**
 * Sound alarm audio synthesizer using Web Audio API
 */
export function playAlertSiren(durationMs = 2500) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(1400, ctx.currentTime + 0.3);
    osc.frequency.linearRampToValueAtTime(700, ctx.currentTime + 0.6);
    osc.frequency.linearRampToValueAtTime(1500, ctx.currentTime + 0.9);
    osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 1.2);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + durationMs / 1000);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);
  } catch (err) {
    console.warn('Could not play siren:', err);
  }
}
