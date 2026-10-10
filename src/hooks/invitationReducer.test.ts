import { describe, expect, it } from 'vitest';
import type { InvitationDto } from '../../shared/schemas';
import {
  invitationReducer as reduce,
  isDraftComplete,
  type InvitationState,
} from './invitationReducer';

const invitation: InvitationDto = {
  displayName: 'Zoka i Danijela',
  guests: [
    { id: 'a', name: 'Zoka', role: 'muz', attending: null },
    { id: 'b', name: 'Danijela', role: 'zena', attending: null },
  ],
  message: null,
  respondedAt: null,
  deadline: '2999-01-01T00:00:00.000Z',
  isClosed: false,
};

const loaded = (inv: InvitationDto = invitation) =>
  reduce({ status: 'loading' }, { type: 'loaded', invitation: inv });

describe('invitationReducer', () => {
  it('starts with no answers; Spasi needs an answer for everyone', () => {
    const state = loaded();
    if (state.status !== 'form') throw new Error(state.status);
    expect(isDraftComplete(invitation, state.draft)).toBe(false);

    const one = reduce(state, { type: 'answer', guestId: 'a', attending: false });
    if (one.status !== 'form') throw new Error(one.status);
    expect(one.draft.answers).toEqual({ a: false, b: null }); // "no" is not the same as "not answered"
    expect(reduce(one, { type: 'submit' })).toBe(one); // incomplete: submit is ignored

    const both = reduce(one, { type: 'answer', guestId: 'b', attending: true });
    if (both.status !== 'form') throw new Error(both.status);
    expect(isDraftComplete(invitation, both.draft)).toBe(true);
    expect(reduce(both, { type: 'submit' }).status).toBe('saving');
  });

  it('pre-fills answers and message of a household that already responded', () => {
    const responded = {
      ...invitation,
      message: 'Hvala!',
      respondedAt: '2027-01-01T10:00:00.000Z',
      guests: invitation.guests.map((g) => ({ ...g, attending: true })),
    };
    const state = loaded(responded);
    expect(state).toMatchObject({
      status: 'form',
      draft: { answers: { a: true, b: true }, message: 'Hvala!' },
    });
  });

  it('shows the closed screen when the deadline has passed', () => {
    expect(loaded({ ...invitation, isClosed: true }).status).toBe('closed');
  });

  it('keeps the selections when saving fails, and can retry or go back', () => {
    let state: InvitationState = loaded();
    state = reduce(state, { type: 'answer', guestId: 'a', attending: true });
    state = reduce(state, { type: 'answer', guestId: 'b', attending: false });
    state = reduce(state, { type: 'message', message: 'Vidimo se' });
    state = reduce(state, { type: 'submit' });
    state = reduce(state, { type: 'saveFailed', rateLimited: false });
    expect(state).toMatchObject({
      status: 'error',
      reason: 'save',
      draft: { answers: { a: true, b: false }, message: 'Vidimo se' },
    });

    expect(reduce(state, { type: 'submit' }).status).toBe('saving');
    expect(reduce(state, { type: 'backToForm' })).toMatchObject({
      status: 'form',
      draft: { answers: { a: true, b: false } },
    });
  });

  it('goes to closed (with server answers) when the deadline passes while the form is open', () => {
    let state: InvitationState = loaded();
    state = reduce(state, { type: 'answer', guestId: 'a', attending: true });
    state = reduce(state, { type: 'answer', guestId: 'b', attending: true });
    state = reduce(state, { type: 'submit' });
    state = reduce(state, { type: 'saveClosed' });
    expect(state).toMatchObject({ status: 'closed', invitation: { isClosed: true } });
    if (state.status === 'closed')
      expect(state.invitation.guests.map((g) => g.attending)).toEqual([null, null]);
  });

  it('"Izmijeni odgovor" returns to the form with the saved answers', () => {
    const saved = {
      ...invitation,
      guests: invitation.guests.map((g) => ({ ...g, attending: false })),
    };
    const state = reduce({ status: 'saved', invitation: saved }, { type: 'edit' });
    expect(state).toMatchObject({ status: 'form', draft: { answers: { a: false, b: false } } });
  });
});
