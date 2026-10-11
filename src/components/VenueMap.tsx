import { event } from '../config/event';
import { bs } from '../i18n/bs';
import common from './common.module.css';
import styles from './VenueMap.module.css';

/** Embedded Google map of the venue plus a link that opens the Maps app. */
export function VenueMap() {
  return (
    <figure className={styles.figure}>
      <div className={styles.frame}>
        <iframe
          className={styles.map}
          src={event.mapEmbedUrl}
          title={bs.event.mapTitle}
          loading="lazy"
          // Only our origin, never the path: the path contains the invitation code.
          referrerPolicy="strict-origin"
          allowFullScreen
        />
      </div>
      <figcaption className={styles.caption}>
        <a className={common.linkButton} href={event.mapUrl} target="_blank" rel="noopener noreferrer">
          {bs.event.map}
        </a>
      </figcaption>
    </figure>
  );
}
