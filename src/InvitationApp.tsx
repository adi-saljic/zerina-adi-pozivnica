import { ClosedScreen } from './components/ClosedScreen';
import { ErrorScreen } from './components/ErrorScreen';
import { InvalidLinkScreen } from './components/InvalidLinkScreen';
import { InvitationScreen } from './components/InvitationScreen';
import { LoadingScreen } from './components/LoadingScreen';
import { SavedScreen } from './components/SavedScreen';
import { SavingScreen } from './components/SavingScreen';
import { useInvitation } from './hooks/useInvitation';

/** Picks the screen for the current state; all logic lives in useInvitation. */
export function InvitationApp({ code }: { code: string | null }) {
  const { state, setAnswer, setName, setMessage, save, edit, backToForm, retryLoad } =
    useInvitation(code);

  switch (state.status) {
    case 'loading':
      return <LoadingScreen />;
    case 'invalid':
      return <InvalidLinkScreen />;
    case 'form':
      return (
        <InvitationScreen
          invitation={state.invitation}
          draft={state.draft}
          onAnswer={setAnswer}
          onName={setName}
          onMessage={setMessage}
          onSave={() => void save()}
        />
      );
    case 'saving':
      return <SavingScreen />;
    case 'saved':
      return <SavedScreen invitation={state.invitation} onEdit={edit} />;
    case 'closed':
      return <ClosedScreen invitation={state.invitation} />;
    case 'error':
      return state.draft ? (
        <ErrorScreen reason={state.reason} onRetry={() => void save()} onBack={backToForm} />
      ) : (
        <ErrorScreen reason={state.reason} onRetry={retryLoad} />
      );
  }
}
