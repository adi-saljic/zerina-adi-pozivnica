import { describe, expect, it } from 'vitest';
import { FLOW_STEPS, PROGRESS_STEPS, isFlowStep, nextStep, previousStep } from './steps';

describe('flow steps', () => {
  it('goes envelope → invitation → where & when → RSVP → message', () => {
    expect(FLOW_STEPS).toEqual(['cover', 'invitation', 'details', 'rsvp', 'message']);
    expect(nextStep('cover')).toBe('invitation');
    expect(nextStep('rsvp')).toBe('message');
    expect(nextStep('message')).toBe('message');
    expect(previousStep('invitation')).toBe('cover');
    expect(previousStep('cover')).toBe('cover');
  });

  it('does not count the envelope in the progress indicator', () => {
    expect(PROGRESS_STEPS).toEqual(['invitation', 'details', 'rsvp', 'message']);
  });

  it('validates steps read back from browser history', () => {
    expect(isFlowStep('rsvp')).toBe(true);
    expect(isFlowStep('admin')).toBe(false);
    expect(isFlowStep(undefined)).toBe(false);
  });
});
