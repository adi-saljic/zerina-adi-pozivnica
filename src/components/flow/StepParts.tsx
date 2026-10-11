import { PROGRESS_STEPS, type ProgressStep } from '../../hooks/steps';
import { bs } from '../../i18n/bs';
import common from '../common.module.css';
import styles from './Steps.module.css';

/** Dots with step names above the card. */
export function StepProgress({ step }: { step: ProgressStep }) {
  const index = PROGRESS_STEPS.indexOf(step);
  return (
    <nav aria-label={bs.steps.progress(index + 1, PROGRESS_STEPS.length)}>
      <ol className={styles.progress}>
        {PROGRESS_STEPS.map((s, i) => (
          <li
            key={s}
            className={i < index ? styles.done : i === index ? styles.current : styles.todo}
            aria-current={i === index ? 'step' : undefined}
          >
            <span className={styles.dot} aria-hidden="true" />
            <span className={styles.stepLabel}>{bs.steps[s]}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Primary action ("Dalje" / "Spasi") with "Nazad" underneath. */
export function StepActions({
  label,
  onNext,
  onBack,
  disabled = false,
  hint,
  hintId,
  type = 'button',
}: {
  label: string;
  onNext?: () => void;
  onBack: () => void;
  disabled?: boolean;
  /** Shown (and announced) while the primary action is disabled. */
  hint?: string;
  hintId?: string;
  type?: 'button' | 'submit';
}) {
  return (
    <div className={common.actions}>
      <button
        type={type}
        className={common.primaryButton}
        onClick={onNext}
        disabled={disabled}
        aria-describedby={disabled && hint ? hintId : undefined}
      >
        {label}
      </button>
      {disabled && hint && (
        <p id={hintId} className={common.muted}>
          {hint}
        </p>
      )}
      <button type="button" className={styles.backButton} onClick={onBack}>
        <span aria-hidden="true">‹ </span>
        {bs.steps.back}
      </button>
    </div>
  );
}
