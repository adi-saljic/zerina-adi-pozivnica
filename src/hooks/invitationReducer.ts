// Screen state machine of the guest page (pure, unit-tested).
//
// loading → invalid | form | closed | error(load)
// form → saving → saved | closed | error(save)
// error(save) keeps the draft, so a retry or "back" never loses selections.

import type { InvitationDto } from '../../shared/schemas';

export type Answers = Record<string, boolean | null>;

export interface Draft {
  answers: Answers;
  message: string;
}

export type ErrorReason = 'load' | 'save' | 'rate_limited';

export type InvitationState =
  | { status: 'loading' }
  | { status: 'invalid' }
  | { status: 'form'; invitation: InvitationDto; draft: Draft }
  | { status: 'saving'; invitation: InvitationDto; draft: Draft }
  | { status: 'saved'; invitation: InvitationDto }
  | { status: 'closed'; invitation: InvitationDto }
  | { status: 'error'; reason: ErrorReason; invitation: InvitationDto | null; draft: Draft | null };

export type InvitationAction =
  | { type: 'retryLoad' }
  | { type: 'loaded'; invitation: InvitationDto }
  | { type: 'notFound' }
  | { type: 'loadFailed'; rateLimited: boolean }
  | { type: 'answer'; guestId: string; attending: boolean }
  | { type: 'message'; message: string }
  | { type: 'submit' }
  | { type: 'saved'; invitation: InvitationDto }
  | { type: 'saveClosed' }
  | { type: 'saveFailed'; rateLimited: boolean }
  | { type: 'edit' }
  | { type: 'backToForm' };

export function draftFrom(invitation: InvitationDto): Draft {
  return {
    answers: Object.fromEntries(invitation.guests.map((g) => [g.id, g.attending])),
    message: invitation.message ?? '',
  };
}

export function isDraftComplete(invitation: InvitationDto, draft: Draft): boolean {
  return invitation.guests.every((g) => typeof draft.answers[g.id] === 'boolean');
}

export function invitationReducer(
  state: InvitationState,
  action: InvitationAction,
): InvitationState {
  switch (action.type) {
    case 'retryLoad':
      return { status: 'loading' };

    case 'loaded':
      return action.invitation.isClosed
        ? { status: 'closed', invitation: action.invitation }
        : { status: 'form', invitation: action.invitation, draft: draftFrom(action.invitation) };

    case 'notFound':
      return { status: 'invalid' };

    case 'loadFailed':
      return {
        status: 'error',
        reason: action.rateLimited ? 'rate_limited' : 'load',
        invitation: null,
        draft: null,
      };

    case 'answer':
      if (state.status !== 'form') return state;
      return {
        ...state,
        draft: {
          ...state.draft,
          answers: { ...state.draft.answers, [action.guestId]: action.attending },
        },
      };

    case 'message':
      if (state.status !== 'form') return state;
      return { ...state, draft: { ...state.draft, message: action.message } };

    case 'submit':
      if (state.status !== 'form' && state.status !== 'error') return state;
      if (!state.invitation || !state.draft || !isDraftComplete(state.invitation, state.draft))
        return state;
      return { status: 'saving', invitation: state.invitation, draft: state.draft };

    case 'saved':
      return { status: 'saved', invitation: action.invitation };

    case 'saveClosed':
      // Show what is actually stored on the server, not the unsaved draft.
      if (state.status !== 'saving') return state;
      return { status: 'closed', invitation: { ...state.invitation, isClosed: true } };

    case 'saveFailed':
      if (state.status !== 'saving') return state;
      return {
        status: 'error',
        reason: action.rateLimited ? 'rate_limited' : 'save',
        invitation: state.invitation,
        draft: state.draft,
      };

    case 'edit':
      if (state.status !== 'saved') return state;
      return { status: 'form', invitation: state.invitation, draft: draftFrom(state.invitation) };

    case 'backToForm':
      if (state.status !== 'error' || !state.invitation || !state.draft) return state;
      return { status: 'form', invitation: state.invitation, draft: state.draft };
  }
}
