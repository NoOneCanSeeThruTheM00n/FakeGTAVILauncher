# Fake GTA VI Launcher

A single-game desktop launcher mockup inspired by the supplied Rockstar Games Launcher.

This project is not affiliated with, endorsed by, or connected to Rockstar Games
or Take-Two Interactive. GTA VI and related names and artwork belong to their
respective owners.

This project is provided for educational purposes only and does not install or
distribute the unreleased GTA VI game.

## Run on Windows

Install Node.js, Rust, and the Windows C++ build tools, then run:

```powershell
npm.cmd install
npm.cmd run tauri dev
```

Choose **Install** to copy the bundled `Grand Theft Auto VI.exe` into the launcher's
application data directory. **Play** starts that executable. The bundled
executable is approximately 574 MB.

## Run on Linux

Install Node.js, Rust, the WebKitGTK development libraries, and GStreamer H.264
codecs. On Ubuntu/Debian:

```bash
sudo apt install build-essential libwebkit2gtk-4.1-dev libssl-dev \
  libayatana-appindicator3-dev librsvg2-dev libxdo-dev patchelf \
  gstreamer1.0-libav gstreamer1.0-plugins-good gstreamer1.0-plugins-bad \
  gstreamer1.0-plugins-ugly
```

Build and stage the native splash executable, then run the launcher:

```bash
cd gta-vi-splash-main-app
npm ci
npm run tauri -- build --no-bundle
cd ..
mkdir -p src-tauri/resources
install -m 755 "gta-vi-splash-main-app/src-tauri/target/release/gta-vi-splash" \
  "src-tauri/resources/Grand Theft Auto VI"
npm ci
npm run tauri dev
```

Linux releases include an AppImage, a Debian package, and a portable ZIP.
The AppImage may require `libfuse2` from your distribution to run. H.264
playback requires compatible GStreamer codecs.

## License

This project is licensed under the [MIT License](LICENSE).

## Verify release provenance

Release binaries are built by the GitHub Actions workflow and include signed
GitHub Artifact Attestations. To verify an asset downloaded from a release,
install the [GitHub CLI](https://cli.github.com/) and run:

```powershell
gh attestation verify .\FakeGTAVILauncher-0.1.0-Setup.exe `
  --repo NoOneCanSeeThruTheM00n/FakeGTAVILauncher
```

Replace the filename with the downloaded asset. Successful verification
confirms the artifact digest and its GitHub Actions build provenance. It does
not certify that the software is safe, nor is it a Windows Authenticode
publisher signature.
