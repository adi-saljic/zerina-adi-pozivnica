import { event } from '../config/event';
import { bs } from '../i18n/bs';
import common from './common.module.css';

/** Compact date / venue block with the map link, for the thank-you and closed screens. */
export function EventSummary() {
  return (
    <section className={common.section} aria-label={bs.event.heading}>
      <h2 className={common.heading}>{bs.event.heading}</h2>
      <p className={common.text}>
        {event.weekdayLabel}, {event.dateLabel} · {event.timeLabel}
        <br />
        {event.venueName}, {event.address}
      </p>
      <p className={common.text}>
        <a className={common.linkButton} href={event.mapUrl} target="_blank" rel="noopener noreferrer">
          {bs.event.map}
        </a>
      </p>
    </section>
  );
}
