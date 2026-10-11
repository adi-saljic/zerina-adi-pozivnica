import { useId, type ReactNode } from 'react';
import type { InvitationDto } from '../../../shared/schemas';
import { isDraftComplete, type Draft } from '../../hooks/invitationReducer';
import { bs } from '../../i18n/bs';
import { formatDateTime } from '../../lib/format';
import { Divider } from '../decor/Decor';
import { GuestAnswer } from '../GuestAnswer';
import { Screen } from '../Screen';
import { StepActions } from './StepParts';
import styles from './Steps.module.css';

/** "Dolazi / Ne dolazi" for every member of the household. */
export function RsvpStep({
  top,
  invitation,
  draft,
  onAnswer,
  onName,
  onNext,
  onBack,
}: {
  top: ReactNode;
  invitation: InvitationDto;
  draft: Draft;
  onAnswer: (guestId: string, attending: boolean) => void;
  onName: (guestId: string, name: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const id = useId();
  const complete = isDraftComplete(invitation, draft);

  return (
    <Screen title={bs.form.heading} titleStyle="script" top={top}>
      <Divider />
      <p className={styles.note}>{bs.form.deadline(formatDateTime(invitation.deadline))}</p>
      {invitation.respondedAt && <p className={styles.note}>{bs.invitation.alreadyResponded}</p>}
      <div className={styles.guests}>
        {invitation.guests.map((guest) => (
          <GuestAnswer
            key={guest.id}
            guest={guest}
            value={draft.answers[guest.id] ?? null}
            name={draft.names[guest.id] ?? ''}
            onChange={(attending) => onAnswer(guest.id, attending)}
            onNameChange={(name) => onName(guest.id, name)}
          />
        ))}
      </div>
      <StepActions
        label={bs.steps.next}
        onNext={onNext}
        onBack={onBack}
        disabled={!complete}
        hint={bs.form.answerEveryone}
        hintId={`${id}-hint`}
      />
    </Screen>
  );
}
