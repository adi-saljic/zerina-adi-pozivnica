import type { InvitationDto } from '../../shared/schemas';
import { bs } from '../i18n/bs';
import { formatDateTime } from '../lib/format';
import styles from './common.module.css';
import { EventDetails } from './EventDetails';
import { Screen } from './Screen';

function answerLabel(attending: boolean | null): string {
  if (attending === null) return bs.closed.noAnswer;
  return attending ? bs.form.attending : bs.form.notAttending;
}

/** Deadline passed: answers are shown read-only. */
export function ClosedScreen({ invitation }: { invitation: InvitationDto }) {
  return (
    <Screen title={bs.closed.title}>
      <p>{bs.closed.body(formatDateTime(invitation.deadline))}</p>

      <section className={styles.section}>
        <h2 className={styles.heading}>{bs.closed.yourAnswers}</h2>
        <dl className={styles.details}>
          {invitation.guests.map((g) => (
            <div key={g.id}>
              <dt>{g.name}</dt>
              <dd>{answerLabel(g.attending)}</dd>
            </div>
          ))}
        </dl>
        {invitation.message && (
          <>
            <h3 className={styles.subheading}>{bs.saved.yourMessage}</h3>
            <p className={styles.message}>{invitation.message}</p>
          </>
        )}
      </section>

      <EventDetails />
    </Screen>
  );
}
