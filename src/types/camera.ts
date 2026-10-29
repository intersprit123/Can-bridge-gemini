export interface CameraCapabilities {
  hasTorch: boolean;
  hasZoom: boolean;
  zoomMin: number;
  zoomMax: number;
  zoomStep: number;
  hasExposureCompensation: boolean;
  exposureMin: number;
  exposureMax: number;
  exposureStep: number;
  hasFacingMode: boolean;
  supportedFacingModes: string[];
  hasWhiteBalance: boolean;
  hasFocusMode: boolean;
  widthMax: number;
  heightMax: number;
}

export interface CameraCurrentSettings {
  torch: boolean;
  zoom: number;
  exposureCompensation: number;
  facingMode: 'user' | 'environment';
  resolution: '4k' | '1080p' | '720p' | '480p';
  frameRate: number;
  whiteBalance: string;
  focusMode: string;
  audioEnabled: boolean;
  nightVision: boolean;
  motionDetection: boolean;
  aspectRatio: number;
}

export type RemoteCommandType =
  | 'SET_TORCH'
  | 'SET_ZOOM'
  | 'SET_EXPOSURE'
  | 'SWITCH_CAMERA'
  | 'SET_RESOLUTION'
  | 'TAKE_PHOTO'
  | 'START_RECORDING'
  | 'STOP_RECORDING'
  | 'TOGGLE_NIGHT_VISION'
  | 'TRIGGER_ALARM'
  | 'TALK_AUDIO_START'
  | 'TALK_AUDIO_STOP'
  | 'REQUEST_SETTINGS';

export interface RemoteCommand {
  type: RemoteCommandType;
  payload?: any;
  timestamp: number;
  senderName: string;
}

export interface NetworkInfo {
  port: number;
  localIps: { iface: string; address: string; isPrivate: boolean }[];
  clientIp: string;
  protocol: string;
  hostHeader: string;
  currentUrl: string;
  suggestedUrls: string[];
}

export interface PeerInfo {
  id: string;
  type: 'camera' | 'controller';
  deviceName: string;
  platform: 'android' | 'ios' | 'windows' | 'mac' | 'linux' | 'other';
  lastSeen: number;
}
