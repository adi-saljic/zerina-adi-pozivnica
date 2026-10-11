import { useEffect, useRef, useState } from 'react';
import { event } from '../../config/event';
import { bs } from '../../i18n/bs';
import { playMusic } from '../../lib/music';
import styles from './CoverStep.module.css';

const OPEN_ANIMATION_MS = 800;
const { portrait, landscape } = event.coverImage;

/** Full-screen photo with the personal greeting. Opening fades it out and starts the music. */
export function CoverStep({ greeting, onOpen }: { greeting: string; onOpen: () => void }) {
  const [opening, setOpening] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    return () => window.clearTimeout(timer.current);
  }, []);

  function open() {
    if (opening) return;
    playMusic(); // must run inside the tap, browsers block audio otherwise
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      onOpen();
      return;
    }
    setOpening(true);
    timer.current = window.setTimeout(onOpen, OPEN_ANIMATION_MS);
  }

  return (
    <main className={`${styles.cover} ${opening ? styles.opening : ''}`}>
      <picture>
        <source
          media="(orientation: landscape)"
          srcSet={`${landscape.small} 1280w, ${landscape.large} 2560w`}
          sizes="100vw"
        />
        <img
          className={styles.photo}
          src={portrait.small}
          srcSet={`${portrait.small} 720w, ${portrait.large} 1440w`}
          sizes="100vw"
          alt={bs.cover.photoAlt}
          fetchPriority="high"
        />
      </picture>
      <div className={styles.shade} aria-hidden="true" />

      <div className={styles.content}>
        <p className={styles.eyebrow}>{bs.cover.eyebrow}</p>
        <h1 ref={headingRef} tabIndex={-1} className={styles.greeting}>
          {greeting}
        </h1>
        <button type="button" className={styles.cta} onClick={open} aria-busy={opening}>
          {bs.cover.open}
        </button>
      </div>
    </main>
  );
}
