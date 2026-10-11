import { bs } from '../i18n/bs';
import styles from './common.module.css';
import { Monogram } from './decor/Decor';

export function LoadingScreen() {
  return (
    <main className={styles.centered}>
      <div className={styles.pulse}>
        <Monogram size={96} />
      </div>
      <p role="status" className={styles.italic}>
        {bs.loading}
      </p>
    </main>
  );
}
