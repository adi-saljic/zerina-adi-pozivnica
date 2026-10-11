import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import type { AdminHousehold, AdminSummary, AttendanceCounts } from '../../shared/adminTypes';
import type { Side } from '../../shared/schemas';
import common from '../components/common.module.css';
import { bs } from '../i18n/bs';
import { formatDateTime, formatShortDateTime } from '../lib/format';
import styles from './AdminPage.module.css';
import {
  FILTERS,
  householdStatus,
  isPartiallyAnswered,
  matchesFilter,
  matchesQuery,
  type Filter,
  type HouseholdStatus,
} from './households';
import { useAdminSummary } from './useAdminSummary';

const t = bs.admin;

type MarkSent = (householdKey: string, sent: boolean, previous: string | null) => Promise<void>;

const FILTER_LABELS: Record<Filter, string> = {
  all: t.filterAll,
  toSend: t.filterToSend,
  waiting: t.filterWaiting,
  opened: t.filterOpened,
  answered: t.filterAnswered,
};

const STATUS_LABELS: Record<HouseholdStatus, string> = {
  new: t.statusNew,
  sent: t.statusSent,
  opened: t.statusOpened,
  answered: t.statusAnswered,
};

// ---- Pieces ------------------------------------------------------------------

function CopyButton({ text, label, ariaLabel }: { text: string; label: string; ariaLabel: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <button
      type="button"
      className={styles.button}
      aria-label={ariaLabel}
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? t.copied : label}
    </button>
  );
}

function Stat({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total?: number;
  tone?: 'yes' | 'no';
}) {
  return (
    <div className={styles.stat} data-tone={tone}>
      <dt>{label}</dt>
      <dd>
        {value}
        {total !== undefined && <small>{t.ofHouseholds(total)}</small>}
      </dd>
      {total !== undefined && (
        <span className={styles.bar} aria-hidden="true">
          <span style={{ width: `${total ? (100 * value) / total : 0}%` }} />
        </span>
      )}
    </div>
  );
}

function Stats({ summary }: { summary: AdminSummary }) {
  const hs = summary.households;
  const total = hs.length;
  return (
    <dl className={styles.stats}>
      <Stat label={t.guests} value={summary.totals.invited} />
      <Stat label={t.attending} value={summary.totals.attending} tone="yes" />
      <Stat label={t.notAttending} value={summary.totals.notAttending} tone="no" />
      <Stat label={t.noAnswer} value={summary.totals.noAnswer} />
      <Stat label={t.sent} value={hs.filter((h) => h.sentAt).length} total={total} />
      <Stat label={t.opened} value={hs.filter((h) => h.firstOpenedAt).length} total={total} />
      <Stat label={t.answered} value={hs.filter((h) => h.respondedAt).length} total={total} />
    </dl>
  );
}

function memberState(attending: boolean | null) {
  if (attending === true) return { key: 'yes', mark: '✓', text: t.memberAttending };
  if (attending === false) return { key: 'no', mark: '✗', text: t.memberNotAttending };
  return { key: 'none', mark: '○', text: t.memberNoAnswer };
}

function HouseholdItem({ h, onSent }: { h: AdminHousehold; onSent: MarkSent }) {
  const status = householdStatus(h);
  const message = bs.whatsapp.invite({
    salutation: h.salutation,
    displayName: h.displayName,
    url: h.link,
  });

  let detail = '';
  if (status === 'answered' && h.respondedAt) detail = t.answeredOn(formatShortDateTime(h.respondedAt));
  else if (status === 'opened' && h.lastOpenedAt)
    detail = t.openedInfo(h.openCount, formatShortDateTime(h.lastOpenedAt));
  else if (status === 'sent') detail = t.notOpened;

  return (
    <li className={styles.row}>
      <label className={styles.sentCell}>
        <input
          type="checkbox"
          checked={h.sentAt !== null}
          onChange={(e) => void onSent(h.householdKey, e.target.checked, h.sentAt)}
          aria-label={t.sentFor(h.displayName)}
        />
        <span>{h.sentAt ? formatShortDateTime(h.sentAt) : t.sent}</span>
      </label>

      <div className={styles.who}>
        <span className={styles.name}>{h.displayName}</span>
        <span className={styles.sideTag}>{bs.sides[h.side]}</span>
        <ul className={styles.members}>
          {h.members.map((m, i) => {
            const state = memberState(m.attending);
            return (
              <li key={i} data-attending={state.key}>
                <span className={styles.mark} aria-hidden="true">
                  {state.mark}
                </span>
                {m.name}
                <span className={styles.srOnly}>, {state.text}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className={styles.stateCell}>
        <span className={styles.badge} data-status={status}>
          {STATUS_LABELS[status]}
        </span>
        {detail && <span className={styles.detail}>{detail}</span>}
        {isPartiallyAnswered(h) && <span className={styles.warn}>{t.partial}</span>}
      </div>

      <div className={styles.actionsCell}>
        <CopyButton
          text={message}
          label={t.copyMessage}
          ariaLabel={t.copyMessageLabel(h.displayName)}
        />
        <CopyButton text={h.link} label={t.copyLink} ariaLabel={t.copyLinkLabel(h.displayName)} />
        <a
          className={styles.button}
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t.whatsappLabel(h.displayName)}
        >
          {t.whatsapp}
        </a>
      </div>
    </li>
  );
}

function Households({ households, onSent }: { households: AdminHousehold[]; onSent: MarkSent }) {
  const headingId = useId();
  const [filter, setFilter] = useState<Filter>('all');
  const [side, setSide] = useState<Side | 'all'>('all');
  const [query, setQuery] = useState('');

  const sides = useMemo(() => [...new Set(households.map((h) => h.side))], [households]);
  const scoped = households.filter(
    (h) => (side === 'all' || h.side === side) && matchesQuery(h, query),
  );
  const visible = scoped.filter((h) => matchesFilter(h, filter));

  return (
    <section className={styles.panel} aria-labelledby={headingId}>
      <div className={styles.panelHead}>
        <h2 id={headingId}>
          {t.households} <span className={styles.count}>{visible.length}</span>
        </h2>
        <input
          type="search"
          className={styles.search}
          placeholder={t.search}
          aria-label={t.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className={styles.filters}>
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={styles.chip}
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
          >
            {FILTER_LABELS[f]}
            <span className={styles.chipCount}>{scoped.filter((h) => matchesFilter(h, f)).length}</span>
          </button>
        ))}
      </div>
      {sides.length > 1 && (
        <div className={styles.filters}>
          {(['all', ...sides] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={styles.chip}
              aria-pressed={side === s}
              onClick={() => setSide(s)}
            >
              {s === 'all' ? t.sideAll : bs.sides[s]}
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <p className={styles.empty}>{t.noMatches}</p>
      ) : (
        <ul className={styles.rows}>
          {visible.map((h) => (
            <HouseholdItem key={h.householdKey} h={h} onSent={onSent} />
          ))}
        </ul>
      )}
    </section>
  );
}

function CountsTable({
  title,
  labelHeader,
  rows,
  withHouseholds,
}: {
  title: string;
  labelHeader: string;
  rows: { key: string; label: string; households?: number; counts: AttendanceCounts }[];
  withHouseholds?: boolean;
}) {
  return (
    <section className={styles.panel}>
      <h2>{title}</h2>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">{labelHeader}</th>
            {withHouseholds && <th scope="col">{t.householdsShort}</th>}
            <th scope="col">{t.invitedShort}</th>
            <th scope="col">
              <abbr title={t.attending}>✓</abbr>
            </th>
            <th scope="col">
              <abbr title={t.notAttending}>✗</abbr>
            </th>
            <th scope="col">
              <abbr title={t.noAnswer}>?</abbr>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <th scope="row">{r.label}</th>
              {withHouseholds && <td>{r.households}</td>}
              <td>{r.counts.invited}</td>
              <td>{r.counts.attending}</td>
              <td>{r.counts.notAttending}</td>
              <td>{r.counts.noAnswer}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Messages({ households }: { households: AdminHousehold[] }) {
  const withMessage = households
    .filter((h): h is AdminHousehold & { message: string } => !!h.message)
    .sort((a, b) => (b.respondedAt ?? '').localeCompare(a.respondedAt ?? ''));
  return (
    <section className={styles.panel}>
      <h2>
        {t.messages} <span className={styles.count}>{withMessage.length}</span>
      </h2>
      {withMessage.length === 0 ? (
        <p className={styles.empty}>{t.none}</p>
      ) : (
        <ul className={styles.messages}>
          {withMessage.map((h) => (
            <li key={h.householdKey}>
              <strong>{h.displayName}</strong>
              {h.respondedAt && (
                <span className={styles.detail}> · {formatShortDateTime(h.respondedAt)}</span>
              )}
              <p>{h.message}</p>
            </li>
          ))}
        </ul>
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

// ---- Page ----------------------------------------------------------------------

export default function AdminPage() {
  const { storedToken, state, load, refresh, markSent, download, logout } = useAdminSummary();

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
      <main className={`${styles.admin} ${styles.narrow}`}>
        <h1 className={styles.title}>{t.title}</h1>
        <LoginForm
          initialToken={storedToken}
          error={state.status === 'idle' ? state.error : null}
          busy={state.status === 'loading'}
          onSubmit={(value, remember) => void load(value, remember)}
        />
      </main>
    );
  }

  const s = state.summary;
  return (
    <main className={styles.admin}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t.title}</h1>
          <p className={styles.meta}>
            {t.generatedAt(formatDateTime(s.generatedAt))} ·{' '}
            {t.deadline(formatDateTime(s.deadline), s.isClosed)}
          </p>
        </div>
        <div className={styles.toolbar}>
          <button type="button" className={styles.button} onClick={() => void refresh()}>
            {t.refresh}
          </button>
          <button type="button" className={styles.button} onClick={() => void download()}>
            {t.downloadCsv}
          </button>
          <button type="button" className={styles.button} onClick={logout}>
            {t.logout}
          </button>
        </div>
      </header>

      <Stats summary={s} />

      <div className={styles.layout}>
        <Households households={s.households} onSent={markSent} />
        <aside className={styles.aside}>
          <CountsTable
            title={t.bySide}
            labelHeader={t.side}
            withHouseholds
            rows={s.bySide.map((r) => ({
              key: r.side,
              label: bs.sides[r.side],
              households: r.households,
              counts: r,
            }))}
          />
          <CountsTable
            title={t.byTable}
            labelHeader={t.table}
            rows={s.byTable.map((r) => ({
              key: r.tableName ?? '',
              label: r.tableName ?? t.noTable,
              counts: r,
            }))}
          />
          <Messages households={s.households} />
        </aside>
      </div>
    </main>
  );
}
