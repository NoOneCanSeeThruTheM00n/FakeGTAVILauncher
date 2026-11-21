import "./styles.css";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

type LauncherState =
  | "checking"
  | "not-installed"
  | "installing"
  | "installed"
  | "running"
  | "launching"
  | "error";

function requireElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Required launcher element ${selector} is missing.`);
  }
  return element;
}

const installButton = requireElement<HTMLButtonElement>("#install-button");
const installLabel = requireElement<HTMLSpanElement>("#install-label");
const playButton = requireElement<HTMLButtonElement>("#play-button");
const installStatus = requireElement<HTMLParagraphElement>("#install-status");
const errorMessage = requireElement<HTMLParagraphElement>("#error-message");
const titlebar = requireElement<HTMLDivElement>(".window-titlebar");
const minimizeButton = requireElement<HTMLButtonElement>("#minimize-button");
const maximizeButton = requireElement<HTMLButtonElement>("#maximize-button");
const closeButton = requireElement<HTMLButtonElement>("#close-button");
const launcher = requireElement<HTMLDivElement>(".launcher");
const sidebarToggle = requireElement<HTMLButtonElement>("#sidebar-toggle");
const libraryGame = requireElement<HTMLButtonElement>(".library-game");
const gameContextMenu = requireElement<HTMLDivElement>("#game-context-menu");
const appWindow = getCurrentWindow();

let state: LauncherState = "checking";

document.addEventListener("contextmenu", (event: MouseEvent) => {
  event.preventDefault();
});

function closeGameContextMenu(): void {
  gameContextMenu.hidden = true;
}

libraryGame.addEventListener("contextmenu", (event: MouseEvent) => {
  event.preventDefault();
  event.stopPropagation();

  const menuWidth = 168;
  const menuHeight = 138;
  const left = Math.min(event.clientX, window.innerWidth - menuWidth - 8);
  const top = Math.min(event.clientY, window.innerHeight - menuHeight - 8);

  gameContextMenu.style.left = `${Math.max(8, left)}px`;
  gameContextMenu.style.top = `${Math.max(8, top)}px`;
  gameContextMenu.hidden = false;
  gameContextMenu.querySelector<HTMLButtonElement>("button")?.focus();
});

document.addEventListener("pointerdown", (event: PointerEvent) => {
  if (event.target instanceof Element && !gameContextMenu.contains(event.target)) {
    closeGameContextMenu();
  }
});

document.addEventListener("keydown", (event: KeyboardEvent) => {
  if (event.key === "Escape") {
    closeGameContextMenu();
  }
  if (event.key === "F5" || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "r")) {
    event.preventDefault();
  }
});

gameContextMenu.addEventListener("click", (event: MouseEvent) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  const action = target.dataset.action;
  closeGameContextMenu();

  if (action === "uninstall") {
    void invoke("uninstall_game")
      .then(() => refreshInstallation())
      .catch((error: unknown) => showWindowError("Could not uninstall the game", error));
  } else if (action === "check-files") {
    void invoke<string>("check_game_files")
      .then((message) => {
        installStatus.textContent = message;
        errorMessage.hidden = true;
      })
      .catch((error: unknown) => showWindowError("Could not check the game files", error));
  } else if (action === "open-folder") {
    void invoke("open_game_folder")
      .catch((error: unknown) => showWindowError("Could not open the game folder", error));
  } else if (action === "open-github") {
    void invoke("open_github")
      .catch((error: unknown) => showWindowError("Could not open GitHub", error));
  }
});

function setState(nextState: LauncherState, detail?: string): void {
  state = nextState;
  errorMessage.hidden = nextState !== "error";
  errorMessage.textContent = nextState === "error" ? detail ?? "Something went wrong." : "";
  installButton.hidden = nextState === "installed" || nextState === "running" || nextState === "launching";
  playButton.hidden = nextState !== "installed" && nextState !== "running";
  playButton.textContent = nextState === "running" ? "CLOSE" : "PLAY";
  installButton.disabled = nextState === "checking" || nextState === "installing";
  installLabel.textContent =
    nextState === "installing" ? "INSTALLING" :
    nextState === "error" ? "RETRY" :
    nextState === "checking" ? "CHECKING" :
    "INSTALL";

  if (nextState === "checking") {
    installStatus.textContent = "Checking installation…";
  } else if (nextState === "not-installed") {
    installStatus.textContent = "";
  } else if (nextState === "installing") {
    installStatus.textContent = "Copying game files to your local app data folder…";
  } else if (nextState === "installed") {
    installStatus.textContent = detail ? `Installed · ${detail}` : "Installed and ready to play";
  } else if (nextState === "running") {
    installStatus.textContent = "Grand Theft Auto VI is running";
  } else if (nextState === "launching") {
    installStatus.textContent = "Launching Grand Theft Auto VI…";
  } else if (nextState === "error") {
    installStatus.textContent = "The requested action could not be completed.";
  }
}

function showWindowError(action: string, error: unknown): void {
  errorMessage.hidden = false;
  errorMessage.textContent = `${action}: ${String(error)}`;
}

async function updateMaximizeState(): Promise<void> {
  try {
    const maximized = await appWindow.isMaximized();
    maximizeButton.classList.toggle("is-maximized", maximized);
    maximizeButton.setAttribute("aria-label", maximized ? "Restore window" : "Maximize window");
  } catch (error: unknown) {
    showWindowError("Could not check the window state", error);
  }
}

titlebar.addEventListener("pointerdown", (event: PointerEvent) => {
  if (event.button !== 0 || (event.target instanceof Element && event.target.closest("button"))) {
    return;
  }

  void appWindow.startDragging().catch((error: unknown) => {
    showWindowError("Could not move the window", error);
  });
});

minimizeButton.addEventListener("click", () => {
  void appWindow.minimize().catch((error: unknown) => {
    showWindowError("Could not minimize the window", error);
  });
});

maximizeButton.addEventListener("click", async () => {
  try {
    await appWindow.toggleMaximize();
    await updateMaximizeState();
  } catch (error: unknown) {
    showWindowError("Could not resize the window", error);
  }
});

closeButton.addEventListener("click", () => {
  void appWindow.close().catch((error: unknown) => {
    showWindowError("Could not close the window", error);
  });
});

sidebarToggle.addEventListener("click", () => {
  const collapsed = launcher.classList.toggle("is-sidebar-collapsed");
  const label = collapsed ? "Expand sidebar" : "Collapse sidebar";
  sidebarToggle.setAttribute("aria-expanded", String(!collapsed));
  sidebarToggle.setAttribute("aria-label", label);
  sidebarToggle.title = label;
});

void updateMaximizeState();
void appWindow
  .onResized(() => {
    void updateMaximizeState();
  })
  .catch((error: unknown) => {
    showWindowError("Could not track the window state", error);
  });

async function refreshInstallation(): Promise<void> {
  setState("checking");
  try {
    const installed = await invoke<boolean>("get_install_status");
    if (!installed) {
      setState("not-installed");
      return;
    }
    const running = await invoke<boolean>("get_game_running");
    setState(running ? "running" : "installed");
  } catch (error: unknown) {
    setState("error", `Could not check the installation: ${String(error)}`);
  }
}

installButton.addEventListener("click", async () => {
  setState("installing");
  try {
    const installedPath = await invoke<string>("install_game");
    setState("installed", installedPath);
  } catch (error: unknown) {
    setState("error", `Installation failed: ${String(error)}`);
  }
});

playButton.addEventListener("click", async () => {
  playButton.disabled = true;
  if (state === "running") {
    try {
      await invoke("close_game");
      setState("installed");
    } catch (error: unknown) {
      setState("error", `Could not close the game: ${String(error)}`);
    } finally {
      playButton.disabled = false;
    }
    return;
  }

  setState("launching");
  try {
    await invoke("play_game");
    setState("running");
  } catch (error: unknown) {
    setState("error", `Could not launch the game: ${String(error)}`);
  } finally {
    playButton.disabled = false;
  }
});

void refreshInstallation();

async function refreshGameProcess(): Promise<void> {
  if (state === "installed" || state === "running") {
    await invoke<boolean>("get_game_running")
      .then((running) => setState(running ? "running" : "installed"))
      .catch(() => undefined);
  }
}

window.setInterval(() => {
  void refreshGameProcess();
}, 1000);

window.addEventListener("focus", () => {
  void refreshGameProcess();
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    void refreshGameProcess();
  }
});
