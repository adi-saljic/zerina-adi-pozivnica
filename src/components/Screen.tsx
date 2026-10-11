import { useEffect, useRef, type ReactNode } from 'react';
import { Sprig } from './decor/Decor';
import styles from './Screen.module.css';

/**
 * The invitation card every screen sits on. Moves focus to the heading when a
 * screen (or step) appears, so screen readers announce it.
 */
export function Screen({
  title,
  titleStyle = 'serif',
  eyebrow,
  top,
  children,
}: {
  title: string;
  /** 'script' for names and greetings, 'serif' for plain headings. */
  titleStyle?: 'script' | 'serif';
  /** Small caps line above the title. */
  eyebrow?: ReactNode;
  /** Rendered above the card (step navigation). */
  top?: ReactNode;
  children?: ReactNode;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <main className={styles.page}>
      {top}
      <article className={styles.card}>
        <Sprig className={styles.sprigTop} />
        <Sprig className={styles.sprigBottom} flip />
        <div className={styles.content}>
          {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
          <h1
            ref={headingRef}
            tabIndex={-1}
            className={titleStyle === 'script' ? styles.titleScript : styles.title}
          >
            {title}
          </h1>
          {children}
        </div>
      </article>
    </main>
  );
}
