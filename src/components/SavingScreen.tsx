import { bs } from '../i18n/bs';
import styles from './common.module.css';
import { Monogram } from './decor/Decor';

export function SavingScreen() {
  return (
    <main className={styles.centered} aria-busy="true">
      <div className={styles.pulse}>
        <Monogram size={96} />
      </div>
      <p role="status" className={styles.italic}>
        {bs.saving}
      </p>
    </main>
  );
}
