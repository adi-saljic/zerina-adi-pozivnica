import { bs } from '../i18n/bs';
import common from './common.module.css';

/** Who is coming / not coming, as two short lists. */
export function AnswerSummary({
  guests,
}: {
  guests: readonly { id: string; label: string; attending: boolean | null }[];
}) {
  const coming = guests.filter((g) => g.attending === true);
  const notComing = guests.filter((g) => g.attending === false);

  if (coming.length === 0 && notComing.length > 0) {
    return <p className={common.text}>{bs.saved.nobodyComing}</p>;
  }
  return (
    <>
      {coming.length > 0 && (
        <>
          <h2 className={common.subheading}>{bs.saved.coming}</h2>
          <ul className={common.list}>
            {coming.map((g) => (
              <li key={g.id}>{g.label}</li>
            ))}
          </ul>
        </>
      )}
      {notComing.length > 0 && (
        <>
          <h2 className={common.subheading}>{bs.saved.notComing}</h2>
          <ul className={common.list}>
            {notComing.map((g) => (
              <li key={g.id}>{g.label}</li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
