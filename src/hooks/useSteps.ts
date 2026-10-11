import { useCallback, useEffect, useState } from 'react';
import { isFlowStep, previousStep, type FlowStep } from './steps';

interface StepState {
  step: FlowStep;
  /** Steps pushed since the flow started; 0 = going back would leave the page. */
  depth: number;
}

function readState(): Partial<StepState> {
  const state: unknown = window.history.state;
  return state && typeof state === 'object' ? (state as Partial<StepState>) : {};
}

/**
 * Current step, kept in the browser history so the phone's back gesture goes
 * to the previous step instead of leaving the page. The URL never changes.
 */
export function useSteps(start: FlowStep) {
  const [step, setStep] = useState<FlowStep>(start);

  useEffect(() => {
    window.history.replaceState({ ...readState(), step: start, depth: 0 }, '');
    const onPop = () => {
      const { step: s } = readState();
      if (isFlowStep(s)) setStep(s);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [start]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  const go = useCallback((next: FlowStep) => {
    const depth = (readState().depth ?? 0) + 1;
    window.history.pushState({ ...readState(), step: next, depth }, '');
    setStep(next);
  }, []);

  const back = useCallback(() => {
    if ((readState().depth ?? 0) > 0) {
      window.history.back(); // popstate sets the step
      return;
    }
    setStep((current) => {
      const prev = previousStep(current);
      window.history.replaceState({ ...readState(), step: prev, depth: 0 }, '');
      return prev;
    });
  }, []);

  return { step, go, back };
}
