// Stationery ornaments as inline SVG (allowed by the CSP, no image requests).
// Purely decorative: hidden from screen readers.
import { event } from '../../config/event';
import styles from './Decor.module.css';

/** "Z & A" inside a double gold ring, like a foil stamp. */
export function Monogram({ size = 96 }: { size?: number }) {
  return (
    <svg
      className={styles.monogram}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="60" cy="60" r="57" className={styles.ring} />
      <circle cx="60" cy="60" r="52" className={styles.ringThin} />
      <text x="40" y="73" className={styles.letter}>
        {event.brideName.charAt(0)}
      </text>
      <text x="60" y="66" className={styles.amp}>
        &amp;
      </text>
      <text x="80" y="80" className={styles.letter}>
        {event.groomName.charAt(0)}
      </text>
    </svg>
  );
}

/** Thin gold rule with a small leaf-and-diamond center. */
export function Divider() {
  return (
    <svg className={styles.divider} viewBox="0 0 220 20" aria-hidden="true" focusable="false">
      <path d="M0 10 H86" className={styles.line} />
      <path d="M134 10 H220" className={styles.line} />
      <path d="M96 10 C 99 5, 104 4, 106 10 C 104 16, 99 15, 96 10 Z" className={styles.leaf} />
      <path d="M124 10 C 121 5, 116 4, 114 10 C 116 16, 121 15, 124 10 Z" className={styles.leaf} />
      <path d="M110 5 L 114 10 L 110 15 L 106 10 Z" className={styles.diamond} />
    </svg>
  );
}

const LEAVES: [number, number, number][] = [
  [20, 100, -110],
  [31, 89, 15],
  [41, 78, -105],
  [51, 66, 20],
  [61, 54, -100],
  [72, 42, 25],
  [84, 31, -95],
  [97, 21, 30],
];

/** A small olive sprig for card corners. `flip` mirrors it for the opposite corner. */
export function Sprig({ className, flip = false }: { className?: string; flip?: boolean }) {
  return (
    <svg
      className={`${styles.sprig} ${className ?? ''}`}
      viewBox="0 0 120 120"
      aria-hidden="true"
      focusable="false"
      style={flip ? { transform: 'scale(-1, -1)' } : undefined}
    >
      <path d="M8 114 C 30 92, 50 66, 68 44 S 98 14, 114 6" className={styles.stem} />
      {LEAVES.map(([x, y, angle]) => (
        <path
          key={`${x}-${y}`}
          d="M0 0 C 5 -5.5, 14 -5.5, 20 0 C 14 5.5, 5 5.5, 0 0 Z"
          transform={`translate(${x} ${y}) rotate(${angle})`}
          className={styles.sprigLeaf}
        />
      ))}
      <circle cx="108" cy="11" r="2.4" className={styles.berry} />
      <circle cx="101" cy="6" r="1.8" className={styles.berry} />
    </svg>
  );
}
