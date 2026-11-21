import "./styles.css";
import splashImageUrl from "./assets/xbs_splash.png";
import bootVideoUrl from "./assets/boot-screen.mov";
import inGameVideoUrl from "./assets/in-game-screen.mov";
import { getCurrentWindow } from "@tauri-apps/api/window";

const appWindow = getCurrentWindow();

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Required element ${selector} is missing.`);
  }
  return element;
}

const splashImage = requireElement<HTMLImageElement>("#splash-image");
const closeButton = requireElement<HTMLButtonElement>("#close-button");
const loadingIndicator = requireElement<HTMLDivElement>("#loading-indicator");
const loadingPercentage = requireElement<HTMLSpanElement>("#loading-percentage");
const cinematicVideo = requireElement<HTMLVideoElement>("#cinematic-video");
const blackScreen = requireElement<HTMLDivElement>("#black-screen");

splashImage.src = splashImageUrl;
splashImage.addEventListener("pointerdown", (event) => {
  if (event.button === 0) {
    void appWindow.startDragging().catch((error: unknown) => {
      console.error("Could not drag the splash window.", error);
    });
  }
});

closeButton.addEventListener("click", () => {
  void appWindow.close().catch((error: unknown) => {
    console.error("Could not close the splash window.", error);
  });
});

const BLACK_SCREEN_DURATION_MS = 2_000;
const FREEZE_DURATION_MS = 3_000;
const LOADING_STAGES = [
  { progress: 18, durationMs: 4_500 },
  { progress: 18, durationMs: 1_500 },
  { progress: 40, durationMs: 5_000 },
  { progress: 40, durationMs: 1_800 },
  { progress: 62, durationMs: 4_500 },
  { progress: 62, durationMs: 1_500 },
  { progress: 83, durationMs: 5_000 },
  { progress: 83, durationMs: 1_800 },
  { progress: 95, durationMs: 3_000 },
  { progress: 95, durationMs: 1_800 },
  { progress: 100, durationMs: 2_500 },
];

function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}

function simulateLoading(): Promise<void> {
  const startedAt = performance.now();
  const totalDuration = LOADING_STAGES.reduce((total, stage) => total + stage.durationMs, 0);

  return new Promise((resolve) => {
    const updateProgress = (now: number) => {
      let elapsed = Math.min(now - startedAt, totalDuration);
      let previousProgress = 0;
      let progress = 100;

      for (const stage of LOADING_STAGES) {
        if (elapsed < stage.durationMs) {
          progress = previousProgress + ((stage.progress - previousProgress) * elapsed) / stage.durationMs;
          break;
        }

        elapsed -= stage.durationMs;
        previousProgress = stage.progress;
        progress = previousProgress;
      }

      const displayedProgress = Math.floor(progress);
      loadingPercentage.textContent = `${displayedProgress}%`;
      loadingIndicator.setAttribute("aria-valuenow", String(displayedProgress));

      if (displayedProgress === 100) {
        resolve();
        return;
      }

      window.requestAnimationFrame(updateProgress);
    };

    window.requestAnimationFrame(updateProgress);
  });
}

function playVideo(source: string, label: string): Promise<void> {
  cinematicVideo.src = source;
  cinematicVideo.classList.remove("is-hidden");
  cinematicVideo.load();

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      cinematicVideo.removeEventListener("ended", onEnded);
      cinematicVideo.removeEventListener("error", onError);
    };
    const onEnded = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error(`Could not play the ${label} video.`));
    };

    cinematicVideo.addEventListener("ended", onEnded);
    cinematicVideo.addEventListener("error", onError);
    void cinematicVideo.play().catch((error: unknown) => {
      cleanup();
      reject(error);
    });
  });
}

async function playLaunchSequence(): Promise<void> {
  await simulateLoading();

  try {
    await appWindow.setFullscreen(true);
  } catch (error: unknown) {
    console.error("Could not switch to fullscreen.", error);
  }

  closeButton.classList.add("is-hidden");
  loadingIndicator.classList.add("is-hidden");
  splashImage.classList.add("is-hidden");

  try {
    await playVideo(bootVideoUrl, "boot screen");

    cinematicVideo.classList.add("is-hidden");
    blackScreen.classList.remove("is-hidden");
    await wait(BLACK_SCREEN_DURATION_MS);
    blackScreen.classList.add("is-hidden");

    await playVideo(inGameVideoUrl, "in-game screen");
    cinematicVideo.pause();
    await wait(FREEZE_DURATION_MS);
  } catch (error: unknown) {
    console.error("The launch sequence could not finish.", error);
  }

  await appWindow.close().catch((error: unknown) => {
    console.error("Could not close the splash window.", error);
  });
}

void playLaunchSequence();
