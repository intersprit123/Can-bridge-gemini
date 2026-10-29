# CamLink Pro — Official Distribution & Store Release Suite

**Applet ID**: `640130b7-63ff-494e-9c56-40ebdfaad129`  
**Application**: CamLink Pro (Cross-Platform IP Camera & Hardware Controller)  
**Version**: `1.0.0` (Production Release)  
**Package Identifier**: `com.camlinkpro.app`  

---

### Artifacts in this Release:

1. **`CamLinkPro-Release.apk`**
   - **Target**: Android Phones & Tablets (API 24+)
   - **Google Play Store Status**: Ready for Play Console internal/production track
   - **Declared Hardware Permissions**:
     - `android.permission.CAMERA`
     - `android.permission.FLASHLIGHT`
     - `android.permission.RECORD_AUDIO`
     - `android.permission.WAKE_LOCK`
     - `android.permission.FOREGROUND_SERVICE_CAMERA`

2. **`CamLinkPro-Setup.exe`**
   - **Target**: Windows 10 & Windows 11 PC (x64 / x86)
   - **Format**: Portable Executable GUI Setup Installer
   - **Capabilities**: Desktop shortcut, local hardware camera streaming, system tray background execution

3. **`CamLinkPro-Installer.msi`**
   - **Target**: Windows PC & Microsoft Store (MSIX / Store Submission)
   - **Format**: Microsoft Compound File Binary (Windows Installer Database)
   - **Product Code**: `{640130B7-63FF-494E-9C56-40EBDFFAAD129}`

---

### In-App Download Endpoints:
The built-in web server exposes direct downloads at:
- **Android APK**: `/api/download/apk` (also at `/downloads/CamLinkPro-Release.apk`)
- **Windows EXE**: `/api/download/exe` (also at `/downloads/CamLinkPro-Setup.exe`)
- **Windows MSI**: `/api/download/msi` (also at `/downloads/CamLinkPro-Installer.msi`)
