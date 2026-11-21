# GTA VI Splash

A frameless Tauri window that displays the bundled splash image. Drag the image
to move the window, or use the subtle **X** in the top-right corner to close it.

## Run

Install Node.js, the Rust toolchain, and (on Windows) Visual Studio Build Tools
with the MSVC C++ workload and Windows SDK, then run:

```powershell
npm install
npm run tauri dev
```

The image is copied into `src/assets/xbs_splash.png`, so the app does not depend
on the original file path after setup.

## Disclaimer

This project is not affiliated with, endorsed by, or connected to Rockstar Games
or Take-Two Interactive. It is made for educational purposes only.

## License

This project is licensed under the [MIT License](LICENSE).
