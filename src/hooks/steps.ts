// Steps of the guest page while the form is open. The envelope ("cover") is the
// opening screen and not counted in the progress indicator.

export const FLOW_STEPS = ['cover', 'invitation', 'details', 'rsvp', 'message'] as const;
export type FlowStep = (typeof FLOW_STEPS)[number];

export type ProgressStep = Exclude<FlowStep, 'cover'>;
export const PROGRESS_STEPS: readonly ProgressStep[] = ['invitation', 'details', 'rsvp', 'message'];

export function isFlowStep(value: unknown): value is FlowStep {
  return typeof value === 'string' && (FLOW_STEPS as readonly string[]).includes(value);
}

export function nextStep(step: FlowStep): FlowStep {
  return FLOW_STEPS[Math.min(FLOW_STEPS.indexOf(step) + 1, FLOW_STEPS.length - 1)]!;
}

export function previousStep(step: FlowStep): FlowStep {
  return FLOW_STEPS[Math.max(FLOW_STEPS.indexOf(step) - 1, 0)]!;
}
