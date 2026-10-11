import type { ReactNode } from 'react';
import { event } from '../../config/event';
import { bs } from '../../i18n/bs';
import { daysUntil } from '../../lib/format';
import common from '../common.module.css';
import { Divider } from '../decor/Decor';
import { Screen } from '../Screen';
import { StepActions } from './StepParts';
import styles from './Steps.module.css';

/** The invitation card itself: names, date, countdown. */
export function InvitationStep({
  greeting,
  top,
  onNext,
  onBack,
}: {
  greeting: string;
  top: ReactNode;
  onNext: () => void;
  onBack: () => void;
}) {
  const days = daysUntil(event.dateIso);
  return (
    <Screen title={greeting} titleStyle="serif" top={top}>
      <p className={styles.invite}>{bs.invitation.invite}</p>
      <p className={styles.names}>
        <span>{event.brideName}</span>
        <span className={styles.amp}>&amp;</span>
        <span>{event.groomName}</span>
      </p>
      <Divider />
      <div className={styles.dateBlock}>
        <span className={styles.weekday}>{event.weekdayLabel}</span>
        <span className={styles.dateNumeric}>{event.dateNumeric}</span>
        <span className={common.muted}>
          {event.venueName} · {event.timeLabel}
        </span>
      </div>
      <p className={common.text}>{bs.invitation.body}</p>
      <p className={styles.countdown}>
        {days > 0 ? bs.invitation.countdown(days) : bs.invitation.today}
      </p>
      <StepActions label={bs.steps.next} onNext={onNext} onBack={onBack} />
    </Screen>
  );
}
