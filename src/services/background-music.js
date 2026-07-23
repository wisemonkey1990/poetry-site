const STORAGE_KEY = "shijing_background_music";
const AUDIO_PATH = "audio/shijing-background-loop.mp3";

let audio;
let button;
let enabled = localStorage.getItem(STORAGE_KEY) === "playing";

export function initializeBackgroundMusic() {
  if (audio) return;
  audio = new Audio(`${import.meta.env.BASE_URL}${AUDIO_PATH}`);
  audio.loop = true;
  audio.preload = "metadata";
  audio.volume = 0.24;
  audio.setAttribute("aria-hidden", "true");

  button = document.createElement("button");
  button.type = "button";
  button.className = "music-toggle";
  button.innerHTML = `
    <span class="music-disc" aria-hidden="true"><i></i><i></i><i></i></span>
    <span class="music-label">清音</span>`;
  button.addEventListener("click", toggleMusic);
  document.body.append(audio, button);

  audio.addEventListener("play", () => updateMusicButton());
  audio.addEventListener("pause", () => updateMusicButton());
  audio.addEventListener("error", () => updateMusicButton("error"));
  updateMusicButton(enabled ? "pending" : "paused");

  if (enabled) {
    tryPlay();
    document.addEventListener("pointerdown", startAfterInteraction, { once: true, capture: true });
    document.addEventListener("keydown", startAfterInteraction, { once: true, capture: true });
  }
}

async function toggleMusic() {
  if (!audio) return;
  if (!audio.paused) {
    enabled = false;
    audio.pause();
    localStorage.setItem(STORAGE_KEY, "paused");
    return;
  }
  enabled = true;
  localStorage.setItem(STORAGE_KEY, "playing");
  await tryPlay();
}

async function tryPlay() {
  if (!enabled || !audio) return;
  try {
    await audio.play();
  } catch {
    updateMusicButton("pending");
  }
}

function startAfterInteraction(event) {
  if (event?.target?.closest?.(".music-toggle")) return;
  tryPlay();
}

function updateMusicButton(forcedState) {
  if (!button || !audio) return;
  const state = forcedState || (audio.paused ? (enabled ? "pending" : "paused") : "playing");
  button.dataset.state = state;
  button.classList.toggle("is-playing", state === "playing");
  const copy = state === "playing" ? "暂停背景音乐" : state === "error" ? "背景音乐暂不可用" : "播放背景音乐";
  button.setAttribute("aria-label", copy);
  button.setAttribute("title", copy);
  button.setAttribute("aria-pressed", String(state === "playing"));
}