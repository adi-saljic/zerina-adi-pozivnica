import { event } from '../config/event';
import { bs } from '../i18n/bs';
import styles from './common.module.css';

export function EventDetails() {
  return (
    <section aria-labelledby="event-heading" className={styles.section}>
      <h2 id="event-heading" className={styles.heading}>
        {bs.event.heading}
      </h2>
      <dl className={styles.details}>
        <dt>{bs.event.date}</dt>
        <dd>{event.dateLabel}</dd>
        <dt>{bs.event.time}</dt>
        <dd>{event.timeLabel}</dd>
        <dt>{bs.event.venue}</dt>
        <dd>{event.venueName}</dd>
        <dt>{bs.event.address}</dt>
        <dd>
          {event.address}
          <br />
          <a href={event.mapUrl} target="_blank" rel="noopener noreferrer">
            {bs.event.map}
          </a>
        </dd>
      </dl>
    </section>
  );
}
