import { useEffect } from 'react';
import type { InvitationDto } from '../../../shared/schemas';
import type { Draft } from '../../hooks/invitationReducer';
import type { FlowStep } from '../../hooks/steps';
import { useSteps } from '../../hooks/useSteps';
import { bs } from '../../i18n/bs';
import { showMusicToggle } from '../../lib/music';
import { CoverStep } from './CoverStep';
import { DetailsStep } from './DetailsStep';
import { InvitationStep } from './InvitationStep';
import { MessageStep } from './MessageStep';
import { RsvpStep } from './RsvpStep';
import { StepProgress } from './StepParts';

/**
 * The guest page as steps: cover photo → invitation → where & when → RSVP → message.
 * Navigation only; answers live in the draft (useInvitation), so moving between
 * steps never loses anything.
 */
export function InvitationFlow({
  invitation,
  draft,
  startAt,
  onAnswer,
  onName,
  onMessage,
  onSave,
}: {
  invitation: InvitationDto;
  draft: Draft;
  startAt: FlowStep;
  onAnswer: (guestId: string, attending: boolean) => void;
  onName: (guestId: string, name: string) => void;
  onMessage: (message: string) => void;
  onSave: () => void;
}) {
  const { step, go, back } = useSteps(startAt);
  useEffect(() => {
    if (step !== 'cover') showMusicToggle();
  }, [step]);
  const greeting = bs.invitation.greeting(invitation.salutation, invitation.displayName);

  switch (step) {
    case 'cover':
      return (
        <CoverStep
          greeting={bs.cover.greeting(invitation.salutation, invitation.displayName)}
          onOpen={() => go('invitation')}
        />
      );
    case 'invitation':
      return (
        <InvitationStep
          greeting={greeting}
          top={<StepProgress step="invitation" />}
          onNext={() => go('details')}
          onBack={back}
        />
      );
    case 'details':
      return (
        <DetailsStep
          top={<StepProgress step="details" />}
          onNext={() => go('rsvp')}
          onBack={back}
        />
      );
    case 'rsvp':
      return (
        <RsvpStep
          top={<StepProgress step="rsvp" />}
          invitation={invitation}
          draft={draft}
          onAnswer={onAnswer}
          onName={onName}
          onNext={() => go('message')}
          onBack={back}
        />
      );
    case 'message':
      return (
        <MessageStep
          top={<StepProgress step="message" />}
          invitation={invitation}
          draft={draft}
          onMessage={onMessage}
          onSave={onSave}
          onBack={back}
        />
      );
  }
}
