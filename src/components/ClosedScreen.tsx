import type { InvitationDto } from '../../shared/schemas';
import { bs } from '../i18n/bs';
import { formatDateTime } from '../lib/format';
import { guestDisplayName } from '../lib/guestName';
import common from './common.module.css';
import { Divider } from './decor/Decor';
import { EventSummary } from './EventSummary';
import { Screen } from './Screen';

function answerLabel(attending: boolean | null): string {
  if (attending === null) return bs.closed.noAnswer;
  return attending ? bs.form.attending : bs.form.notAttending;
}

/** Deadline passed: answers are shown read-only. */
export function ClosedScreen({ invitation }: { invitation: InvitationDto }) {
  return (
    <Screen
      title={bs.closed.title}
      eyebrow={bs.invitation.greeting(invitation.salutation, invitation.displayName)}
    >
      <p className={common.text}>{bs.closed.body(formatDateTime(invitation.deadline))}</p>
      <Divider />
      <section className={common.section}>
        <h2 className={common.heading}>{bs.closed.yourAnswers}</h2>
        <dl className={common.details}>
          {invitation.guests.map((g) => (
            <div key={g.id}>
              <dt>{guestDisplayName(g)}</dt>
              <dd>{answerLabel(g.attending)}</dd>
            </div>
          ))}
        </dl>
        {invitation.message && (
          <>
            <h3 className={common.subheading}>{bs.saved.yourMessage}</h3>
            <p className={common.message}>{invitation.message}</p>
          </>
        )}
      </section>
      <Divider />
      <EventSummary />
    </Screen>
  );
}
