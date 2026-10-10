import type { InvitationDto } from '../../shared/schemas';
import type { Draft } from '../hooks/invitationReducer';
import { bs } from '../i18n/bs';
import { EventDetails } from './EventDetails';
import { RsvpForm } from './RsvpForm';
import { Screen } from './Screen';

export function InvitationScreen(props: {
  invitation: InvitationDto;
  draft: Draft;
  onAnswer: (guestId: string, attending: boolean) => void;
  onMessage: (message: string) => void;
  onSave: () => void;
}) {
  return (
    <Screen title={bs.invitation.greeting(props.invitation.displayName)}>
      <p>{bs.invitation.intro}</p>
      <EventDetails />
      <RsvpForm {...props} />
    </Screen>
  );
}
