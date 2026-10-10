import type { InvitationDto } from '../../shared/schemas';
import { bs } from '../i18n/bs';
import { formatDateTime } from '../lib/format';
import styles from './common.module.css';
import { EventDetails } from './EventDetails';
import { Screen } from './Screen';

export function SavedScreen({
  invitation,
  onEdit,
}: {
  invitation: InvitationDto;
  onEdit: () => void;
}) {
  const coming = invitation.guests.filter((g) => g.attending === true);
  const notComing = invitation.guests.filter((g) => g.attending === false);

  return (
    <Screen title={bs.saved.title}>
      <section className={styles.section} aria-label={bs.closed.yourAnswers}>
        {coming.length === 0 ? (
          <p>{bs.saved.nobodyComing}</p>
        ) : (
          <>
            <h2 className={styles.heading}>{bs.saved.coming}</h2>
            <ul>
              {coming.map((g) => (
                <li key={g.id}>{g.name}</li>
              ))}
            </ul>
          </>
        )}
        {notComing.length > 0 && coming.length > 0 && (
          <>
            <h2 className={styles.heading}>{bs.saved.notComing}</h2>
            <ul>
              {notComing.map((g) => (
                <li key={g.id}>{g.name}</li>
              ))}
            </ul>
          </>
        )}
        {invitation.message && (
          <>
            <h2 className={styles.heading}>{bs.saved.yourMessage}</h2>
            <p className={styles.message}>{invitation.message}</p>
          </>
        )}
      </section>

      <p>{bs.saved.canEditUntil(formatDateTime(invitation.deadline))}</p>
      <button type="button" className={styles.secondaryButton} onClick={onEdit}>
        {bs.saved.edit}
      </button>

      <EventDetails />
    </Screen>
  );
}
