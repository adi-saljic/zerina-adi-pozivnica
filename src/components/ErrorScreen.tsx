import type { ErrorReason } from '../hooks/invitationReducer';
import { bs } from '../i18n/bs';
import styles from './common.module.css';
import { Screen } from './Screen';

export function ErrorScreen({
  reason,
  onRetry,
  onBack,
}: {
  reason: ErrorReason;
  onRetry: () => void;
  /** Only when a draft exists (save failed): go back without losing selections. */
  onBack?: () => void;
}) {
  const text =
    reason === 'rate_limited'
      ? bs.error.rateLimited
      : reason === 'save'
        ? bs.error.save
        : bs.error.load;
  return (
    <Screen title={bs.error.title}>
      <p role="alert" className={styles.text}>
        {text}
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.primaryButton} onClick={onRetry}>
          {bs.error.retry}
        </button>
        {onBack && (
          <button type="button" className={styles.secondaryButton} onClick={onBack}>
            {bs.error.back}
          </button>
        )}
      </div>
    </Screen>
  );
}
