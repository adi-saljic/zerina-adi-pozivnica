import { GUEST_NAME_MAX_LENGTH, type GuestDto } from '../../shared/schemas';
import { bs } from '../i18n/bs';
import styles from './GuestAnswer.module.css';

/**
 * Two explicit options per guest. Neither selected = not answered yet, which
 * must stay distinguishable from "Ne dolazi" (a single checkbox couldn't do that).
 *
 * Placeholder members ("Ljubo +1") are shown by a label ("Pratnja", "Dijete"),
 * never by their placeholder text, with an optional field for the real name.
 */
export function GuestAnswer({
  guest,
  value,
  name,
  onChange,
  onNameChange,
}: {
  guest: GuestDto;
  value: boolean | null;
  /** Typed-in name, only used for placeholder members. */
  name: string;
  onChange: (attending: boolean) => void;
  onNameChange: (name: string) => void;
}) {
  const group = `guest-${guest.id}`;
  const nameInputId = `guest-name-${guest.id}`;
  return (
    <fieldset className={styles.guest}>
      <legend className={`${styles.name} ${guest.isPlaceholder ? styles.placeholder : ''}`}>
        {guest.isPlaceholder ? bs.placeholderLabels[guest.role] : guest.name}
      </legend>
      <div className={styles.options}>
        <label className={styles.option}>
          <input
            type="radio"
            name={group}
            value="yes"
            checked={value === true}
            onChange={() => onChange(true)}
          />
          <span>{bs.form.attending}</span>
        </label>
        <label className={styles.option}>
          <input
            type="radio"
            name={group}
            value="no"
            checked={value === false}
            onChange={() => onChange(false)}
          />
          <span>{bs.form.notAttending}</span>
        </label>
      </div>
      {guest.isPlaceholder && (
        <div className={styles.nameField}>
          <label htmlFor={nameInputId}>{bs.form.placeholderName}</label>
          <input
            id={nameInputId}
            type="text"
            className={styles.nameInput}
            autoComplete="off"
            maxLength={GUEST_NAME_MAX_LENGTH}
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
          />
        </div>
      )}
    </fieldset>
  );
}
