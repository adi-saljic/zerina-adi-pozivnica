import { bs } from '../i18n/bs';
import styles from './common.module.css';

export function SavingScreen() {
  return (
    <main className={styles.centered} aria-busy="true">
      <p role="status">{bs.saving}</p>
    </main>
  );
}
