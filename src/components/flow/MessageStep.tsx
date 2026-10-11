import { useId, type FormEvent, type ReactNode } from 'react';
import { MESSAGE_MAX_LENGTH, type InvitationDto } from '../../../shared/schemas';
import { isDraftComplete, type Draft } from '../../hooks/invitationReducer';
import { bs } from '../../i18n/bs';
import { guestDisplayName } from '../../lib/guestName';
import { AnswerSummary } from '../AnswerSummary';
import common from '../common.module.css';
import { Divider } from '../decor/Decor';
import { Screen } from '../Screen';
import { StepActions } from './StepParts';
import styles from './Steps.module.css';

/** Optional message to the couple, a summary of the answers, and "Spasi". */
export function MessageStep({
  top,
  invitation,
  draft,
  onMessage,
  onSave,
  onBack,
}: {
  top: ReactNode;
  invitation: InvitationDto;
  draft: Draft;
  onMessage: (message: string) => void;
  onSave: () => void;
  onBack: () => void;
}) {
  const id = useId();
  const complete = isDraftComplete(invitation, draft);
  const summary = invitation.guests.map((g) => ({
    id: g.id,
    label: g.isPlaceholder
      ? draft.names[g.id]?.trim() || guestDisplayName({ ...g, nameFromGuest: null })
      : g.name,
    attending: draft.answers[g.id] ?? null,
  }));

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (complete) onSave();
  }

  return (
    <Screen title={bs.form.messageHeading} titleStyle="script" top={top}>
      <Divider />
      <form onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <label htmlFor={`${id}-message`}>{bs.form.messageLabel}</label>
          <textarea
            id={`${id}-message`}
            className={styles.textarea}
            rows={4}
            maxLength={MESSAGE_MAX_LENGTH}
            value={draft.message}
            onChange={(e) => onMessage(e.target.value)}
            aria-describedby={`${id}-count`}
          />
          <p id={`${id}-count`} className={styles.counter}>
            {bs.form.charactersLeft(MESSAGE_MAX_LENGTH - draft.message.length)}
          </p>
        </div>

        <section className={common.section} aria-label={bs.form.summary}>
          <AnswerSummary guests={summary} />
        </section>

        <StepActions label={bs.form.save} type="submit" onBack={onBack} disabled={!complete} />
      </form>
    </Screen>
  );
}
