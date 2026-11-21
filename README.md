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

Choose **Install** to copy the bundled `gta-vi-splash.exe` into the launcher's
application data directory. **Play** starts that executable. The bundled
executable is approximately 574 MB.

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
