import { useSyncExternalStore } from 'react';
import { event } from '../config/event';

// Background music, one player for the whole page so it keeps playing across
// steps and screens. Browsers only allow audio after a tap, so playMusic() must
// be called from a click handler. The file is only downloaded on the first play.

const VOLUME = 0.4;
const FADE_STEPS = 25;
const FADE_INTERVAL_MS = 80;

interface MusicState {
  /** The speaker button is shown once the invitation is open (not on the cover). */
  visible: boolean;
  playing: boolean;
}

let state: MusicState = { visible: false, playing: false };
let audio: HTMLAudioElement | null = null;
let fadeTimer: number | undefined;
let resumeWhenVisible = false;
const listeners = new Set<() => void>();

function setState(next: Partial<MusicState>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

function createAudio(): HTMLAudioElement {
  const el = new Audio(event.music.src);
  el.loop = true;
  el.addEventListener('play', () => setState({ playing: true }));
  el.addEventListener('pause', () => setState({ playing: false }));
  // Don't keep playing when the guest switches to another app or tab.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !el.paused) {
      resumeWhenVisible = true;
      el.pause();
    } else if (!document.hidden && resumeWhenVisible) {
      resumeWhenVisible = false;
      playMusic();
    }
  });
  return el;
}

/** Fades in to VOLUME. iOS ignores element volume and plays at the phone's volume. */
function fadeIn(el: HTMLAudioElement) {
  window.clearInterval(fadeTimer);
  el.volume = 0;
  fadeTimer = window.setInterval(() => {
    el.volume = Math.min(VOLUME, el.volume + VOLUME / FADE_STEPS);
    if (el.volume >= VOLUME) window.clearInterval(fadeTimer);
  }, FADE_INTERVAL_MS);
}

export function playMusic(): void {
  if (!event.music.enabled) return;
  audio ??= createAudio();
  setState({ visible: true });
  fadeIn(audio);
  audio.play().catch(() => setState({ playing: false }));
}

/** Shows the speaker button without playing, e.g. when the page starts past the cover. */
export function showMusicToggle(): void {
  if (event.music.enabled && !state.visible) setState({ visible: true });
}

export function pauseMusic(): void {
  resumeWhenVisible = false;
  audio?.pause();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useMusic(): MusicState {
  return useSyncExternalStore(subscribe, () => state);
}
