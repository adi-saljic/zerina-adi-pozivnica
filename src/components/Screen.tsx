import { useEffect, useRef, type ReactNode } from 'react';
import styles from './Screen.module.css';

/**
 * Page frame shared by all screens. Moves focus to the heading when a screen
 * appears, so screen readers announce the new state (e.g. "saved").
 */
export function Screen({ title, children }: { title: string; children?: ReactNode }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <main className={styles.page}>
      <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
        {title}
      </h1>
      {children}
    </main>
  );
}
