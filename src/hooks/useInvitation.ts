import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { ApiError, fetchInvitation, submitRsvp } from '../lib/apiClient';
import { canonicalizeUrl } from '../lib/invitationUrl';
import { invitationReducer } from './invitationReducer';

export function useInvitation(code: string | null) {
  const [state, dispatch] = useReducer(
    invitationReducer,
    code ? { status: 'loading' } : { status: 'invalid' },
  );
  // Each load attempt fetches once, even under React StrictMode's double effects
  // (otherwise every page view would count as two opens).
  const [attempt, setAttempt] = useState(0);
  const fetchedAttempt = useRef<number | null>(null);

  useEffect(() => {
    if (!code || fetchedAttempt.current === attempt) return;
    fetchedAttempt.current = attempt;
    fetchInvitation(code).then(
      (invitation) => {
        dispatch({ type: 'loaded', invitation });
        // ?g=, /p/ or an outdated slug → the current /<slug>-<code>.
        canonicalizeUrl(window.location, window.history, invitation.slug, code);
      },
      (error: unknown) => {
        if (error instanceof ApiError && error.code === 'not_found') dispatch({ type: 'notFound' });
        else {
          dispatch({
            type: 'loadFailed',
            rateLimited: error instanceof ApiError && error.code === 'rate_limited',
          });
        }
      },
    );
  }, [code, attempt]);

  const save = useCallback(async () => {
    if (!code || (state.status !== 'form' && state.status !== 'error')) return;
    const { invitation, draft } = state;
    if (!invitation || !draft) return;

    dispatch({ type: 'submit' });
    try {
      const saved = await submitRsvp({
        code,
        responses: invitation.guests.map((g) => ({
          guestId: g.id,
          attending: draft.answers[g.id] === true,
          // The API accepts a name only for placeholder members.
          ...(g.isPlaceholder ? { name: draft.names[g.id] ?? '' } : {}),
        })),
        message: draft.message,
      });
      dispatch({ type: 'saved', invitation: saved });
    } catch (error) {
      const apiCode = error instanceof ApiError ? error.code : null;
      if (apiCode === 'closed') dispatch({ type: 'saveClosed' });
      else if (apiCode === 'not_found') dispatch({ type: 'notFound' });
      else dispatch({ type: 'saveFailed', rateLimited: apiCode === 'rate_limited' });
    }
  }, [code, state]);

  return {
    state,
    setAnswer: (guestId: string, attending: boolean) =>
      dispatch({ type: 'answer', guestId, attending }),
    setName: (guestId: string, name: string) => dispatch({ type: 'name', guestId, name }),
    setMessage: (message: string) => dispatch({ type: 'message', message }),
    save,
    edit: () => dispatch({ type: 'edit' }),
    backToForm: () => dispatch({ type: 'backToForm' }),
    retryLoad: () => {
      dispatch({ type: 'retryLoad' });
      setAttempt((n) => n + 1);
    },
  };
}
