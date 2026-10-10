import { useId, type FormEvent } from 'react';
import { MESSAGE_MAX_LENGTH, type InvitationDto } from '../../shared/schemas';
import type { Draft } from '../hooks/invitationReducer';
import { isDraftComplete } from '../hooks/invitationReducer';
import { bs } from '../i18n/bs';
import { formatDateTime } from '../lib/format';
import common from './common.module.css';
import { GuestAnswer } from './GuestAnswer';
import styles from './RsvpForm.module.css';

export function RsvpForm({
  invitation,
  draft,
  onAnswer,
  onMessage,
  onSave,
}: {
  invitation: InvitationDto;
  draft: Draft;
  onAnswer: (guestId: string, attending: boolean) => void;
  onMessage: (message: string) => void;
  onSave: () => void;
}) {
  const ids = useId();
  const complete = isDraftComplete(invitation, draft);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (complete) onSave();
  }

  return (
    <section aria-labelledby={`${ids}-heading`} className={common.section}>
      <h2 id={`${ids}-heading`} className={common.heading}>
        {bs.form.heading}
      </h2>
      <p>{bs.form.deadline(formatDateTime(invitation.deadline))}</p>
      {invitation.respondedAt && <p>{bs.invitation.alreadyResponded}</p>}

      <form onSubmit={handleSubmit} noValidate>
        {invitation.guests.map((guest) => (
          <GuestAnswer
            key={guest.id}
            guest={guest}
            value={draft.answers[guest.id] ?? null}
            onChange={(attending) => onAnswer(guest.id, attending)}
          />
        ))}

        <div className={styles.field}>
          <label htmlFor={`${ids}-message`}>{bs.form.messageLabel}</label>
          <textarea
            id={`${ids}-message`}
            className={styles.textarea}
            rows={4}
            maxLength={MESSAGE_MAX_LENGTH}
            value={draft.message}
            onChange={(e) => onMessage(e.target.value)}
            aria-describedby={`${ids}-count`}
          />
          <p id={`${ids}-count`} className={common.muted}>
            {bs.form.charactersLeft(MESSAGE_MAX_LENGTH - draft.message.length)}
          </p>
        </div>

        <button
          type="submit"
          className={common.primaryButton}
          disabled={!complete}
          aria-describedby={complete ? undefined : `${ids}-hint`}
        >
          {bs.form.save}
        </button>
        {!complete && (
          <p id={`${ids}-hint`} className={common.muted}>
            {bs.form.answerEveryone}
          </p>
        )}
      </form>
    </section>
  );
}
