import type { ReactNode } from 'react';
import { event } from '../../config/event';
import { bs } from '../../i18n/bs';
import common from '../common.module.css';
import { Divider } from '../decor/Decor';
import { Screen } from '../Screen';
import { VenueMap } from '../VenueMap';
import { StepActions } from './StepParts';

/** Where and when, with the map. */
export function DetailsStep({
  top,
  onNext,
  onBack,
}: {
  top: ReactNode;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <Screen title={bs.event.heading} titleStyle="script" top={top}>
      <Divider />
      <dl className={common.details}>
        <dt>{bs.event.date}</dt>
        <dd>
          {event.weekdayLabel}, {event.dateLabel}
        </dd>
        <dt>{bs.event.time}</dt>
        <dd>{event.timeLabel}</dd>
        <dt>{bs.event.venue}</dt>
        <dd>{event.venueName}</dd>
        <dt>{bs.event.address}</dt>
        <dd>{event.address}</dd>
      </dl>
      <VenueMap />
      <StepActions label={bs.steps.next} onNext={onNext} onBack={onBack} />
    </Screen>
  );
}
