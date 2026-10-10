import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { AttendanceCounts, HouseholdBrief } from '../../shared/adminTypes';
import { Screen } from '../components/Screen';
import common from '../components/common.module.css';
import { bs } from '../i18n/bs';
import { formatDateTime } from '../lib/format';
import styles from './AdminPage.module.css';
import { useAdminSummary } from './useAdminSummary';

const t = bs.admin;

function CountCells({ c }: { c: AttendanceCounts }) {
  return (
    <>
      <td>{c.invited}</td>
      <td>{c.attending}</td>
      <td>{c.notAttending}</td>
      <td>{c.noAnswer}</td>
    </>
  );
}

const countHeaders = (
  <>
    <th scope="col">{t.invited}</th>
    <th scope="col">{t.attending}</th>
    <th scope="col">{t.notAttending}</th>
    <th scope="col">{t.noAnswer}</th>
  </>
);

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={styles.smallButton}
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => setCopied(true));
      }}
    >
      {copied ? t.copied : t.copy}
    </button>
  );
}

function HouseholdList({ title, items }: { title: string; items: HouseholdBrief[] }) {
  return (
    <section className={common.section}>
      <h2 className={common.heading}>
        {title} ({items.length})
      </h2>
      {items.length === 0 ? (
        <p>{t.none}</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t.household}</th>
                <th scope="col">{t.side}</th>
                <th scope="col">{t.guests}</th>
                <th scope="col">{t.opened}</th>
                <th scope="col">{t.link}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((h) => (
                <tr key={h.householdKey}>
                  <th scope="row">{h.displayName}</th>
                  <td>{bs.sides[h.side]}</td>
                  <td>{h.guests}</td>
                  <td>
                    {h.lastOpenedAt ? `${h.openCount}× · ${formatDateTime(h.lastOpenedAt)}` : '—'}
                  </td>
                  <td>
                    <span className={styles.url}>{h.link}</span> <CopyButton text={h.link} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function LoginForm({
  initialToken,
  error,
  busy,
  onSubmit,
}: {
  initialToken: string;
  error: string | null;
  busy: boolean;
  onSubmit: (token: string, remember: boolean) => void;
}) {
  const ids = useId();
  const [value, setValue] = useState(initialToken);
  const [remember, setRemember] = useState(initialToken !== '');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (value.trim()) onSubmit(value.trim(), remember);
  }

  return (
    <form onSubmit={handleSubmit} className={styles.login}>
      <label htmlFor={`${ids}-token`}>{t.tokenLabel}</label>
      <input
        id={`${ids}-token`}
        type="password"
        autoComplete="current-password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={styles.input}
        aria-describedby={error ? `${ids}-error` : undefined}
      />
      <label className={styles.checkbox}>
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        {t.remember}
      </label>
      <button type="submit" className={common.primaryButton} disabled={busy}>
        {busy ? t.loading : t.login}
      </button>
      {error && (
        <p id={`${ids}-error`} role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </form>
  );
}

export default function AdminPage() {
  const { token, storedToken, state, load, download, logout } = useAdminSummary();

  // A remembered token loads the summary straight away (once).
  const autoLoaded = useRef(false);
  useEffect(() => {
    if (storedToken && !autoLoaded.current) {
      autoLoaded.current = true;
      void load(storedToken, true);
    }
  }, [storedToken, load]);

  if (state.status !== 'ready') {
    return (
      <Screen title={t.title}>
        <LoginForm
          initialToken={storedToken}
          error={state.status === 'idle' ? state.error : null}
          busy={state.status === 'loading'}
          onSubmit={(value, remember) => void load(value, remember)}
        />
      </Screen>
    );
  }

  const s = state.summary;
  return (
    <Screen title={t.title}>
      <p className={common.muted}>
        {t.generatedAt(formatDateTime(s.generatedAt))} ·{' '}
        {t.deadline(formatDateTime(s.deadline), s.isClosed)}
      </p>
      <div className={common.actions}>
        <button
          type="button"
          className={common.secondaryButton}
          onClick={() => void load(token, false)}
        >
          {t.refresh}
        </button>
        <button type="button" className={common.secondaryButton} onClick={() => void download()}>
          {t.downloadCsv}
        </button>
        <button type="button" className={common.secondaryButton} onClick={logout}>
          {t.logout}
        </button>
      </div>

      <section className={common.section}>
        <h2 className={common.heading}>{t.totals}</h2>
        <dl className={common.details}>
          <dt>{t.invited}</dt>
          <dd>{s.totals.invited}</dd>
          <dt>{t.attending}</dt>
          <dd>{s.totals.attending}</dd>
          <dt>{t.notAttending}</dt>
          <dd>{s.totals.notAttending}</dd>
          <dt>{t.noAnswer}</dt>
          <dd>{s.totals.noAnswer}</dd>
          <dt>{t.households}</dt>
          <dd>{s.totals.households}</dd>
          <dt>{t.householdsOpened}</dt>
          <dd>{s.totals.householdsOpened}</dd>
          <dt>{t.householdsResponded}</dt>
          <dd>{s.totals.householdsResponded}</dd>
        </dl>
      </section>

      <section className={common.section}>
        <h2 className={common.heading}>{t.bySide}</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t.side}</th>
                <th scope="col">{t.households}</th>
                {countHeaders}
              </tr>
            </thead>
            <tbody>
              {s.bySide.map((row) => (
                <tr key={row.side}>
                  <th scope="row">{bs.sides[row.side]}</th>
                  <td>{row.households}</td>
                  <CountCells c={row} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={common.section}>
        <h2 className={common.heading}>{t.byTable}</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t.table}</th>
                {countHeaders}
              </tr>
            </thead>
            <tbody>
              {s.byTable.map((row) => (
                <tr key={row.tableName ?? ''}>
                  <th scope="row">{row.tableName ?? t.noTable}</th>
                  <CountCells c={row} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <HouseholdList title={t.notResponded} items={s.notResponded} />
      <HouseholdList title={t.notOpened} items={s.notOpened} />
      {s.partiallyAnswered.length > 0 && (
        <HouseholdList title={t.partiallyAnswered} items={s.partiallyAnswered} />
      )}

      <section className={common.section}>
        <h2 className={common.heading}>
          {t.messages} ({s.messages.length})
        </h2>
        {s.messages.length === 0 ? (
          <p>{t.none}</p>
        ) : (
          <ul className={styles.messages}>
            {s.messages.map((m, i) => (
              <li key={`${i}-${m.displayName}`}>
                <strong>{m.displayName}</strong>
                {m.respondedAt && (
                  <span className={common.muted}> · {formatDateTime(m.respondedAt)}</span>
                )}
                <p className={common.message}>{m.message}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Screen>
  );
}
