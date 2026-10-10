import { bs } from '../i18n/bs';
import styles from './common.module.css';

export function LoadingScreen() {
  return (
    <main className={styles.centered}>
      <p role="status">{bs.loading}</p>
    </main>
  );
}
