import type { InvitationDto } from '../../shared/schemas';
import { bs } from '../i18n/bs';
import { formatDateTime } from '../lib/format';
import { guestDisplayName } from '../lib/guestName';
import { AnswerSummary } from './AnswerSummary';
import common from './common.module.css';
import { Divider } from './decor/Decor';
import { EventSummary } from './EventSummary';
import { Screen } from './Screen';

export function SavedScreen({
  invitation,
  onEdit,
}: {
  invitation: InvitationDto;
  onEdit: () => void;
}) {
  const anyoneComing = invitation.guests.some((g) => g.attending === true);
  return (
    <Screen title={bs.saved.title} titleStyle="script">
      <p className={common.lead}>{bs.saved.subtitle}</p>
      <Divider />
      <section className={common.section} aria-label={bs.closed.yourAnswers}>
        <AnswerSummary
          guests={invitation.guests.map((g) => ({
            id: g.id,
            label: guestDisplayName(g),
            attending: g.attending,
          }))}
        />
        {invitation.message && (
          <>
            <h2 className={common.subheading}>{bs.saved.yourMessage}</h2>
            <p className={common.message}>{invitation.message}</p>
          </>
        )}
      </section>
      {anyoneComing && <p className={`${common.lead} ${common.italic}`}>{bs.saved.seeYou}</p>}

      <div className={common.actions}>
        <button type="button" className={common.secondaryButton} onClick={onEdit}>
          {bs.saved.edit}
        </button>
        <p className={common.muted}>{bs.saved.canEditUntil(formatDateTime(invitation.deadline))}</p>
      </div>

      <Divider />
      <EventSummary />
    </Screen>
  );
}
