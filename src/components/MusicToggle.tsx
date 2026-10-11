import { event } from '../config/event';
import { bs } from '../i18n/bs';
import { pauseMusic, playMusic, useMusic } from '../lib/music';
import styles from './MusicToggle.module.css';

/** Floating speaker button. Shown once the invitation is open. */
export function MusicToggle() {
  const { visible, playing } = useMusic();
  if (!event.music.enabled || !visible) return null;

  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={playing ? pauseMusic : playMusic}
      aria-label={playing ? bs.music.pause : bs.music.play}
    >
      <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true">
        <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" className={styles.speaker} />
        {playing ? (
          <path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11" className={styles.line} />
        ) : (
          <path d="M15.5 9.5l5 5M20.5 9.5l-5 5" className={styles.line} />
        )}
      </svg>
    </button>
  );
}
