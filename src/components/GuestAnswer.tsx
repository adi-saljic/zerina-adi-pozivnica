import type { GuestDto } from '../../shared/schemas';
import { bs } from '../i18n/bs';
import styles from './GuestAnswer.module.css';

/**
 * Two explicit options per guest. Neither selected = not answered yet, which
 * must stay distinguishable from "Ne dolazi" (a single checkbox couldn't do that).
 */
export function GuestAnswer({
  guest,
  value,
  onChange,
}: {
  guest: GuestDto;
  value: boolean | null;
  onChange: (attending: boolean) => void;
}) {
  const name = `guest-${guest.id}`;
  return (
    <fieldset className={styles.guest}>
      <legend className={styles.name}>{guest.name}</legend>
      <div className={styles.options}>
        <label className={styles.option}>
          <input
            type="radio"
            name={name}
            value="yes"
            checked={value === true}
            onChange={() => onChange(true)}
          />
          <span>{bs.form.attending}</span>
        </label>
        <label className={styles.option}>
          <input
            type="radio"
            name={name}
            value="no"
            checked={value === false}
            onChange={() => onChange(false)}
          />
          <span>{bs.form.notAttending}</span>
        </label>
      </div>
    </fieldset>
  );
}
