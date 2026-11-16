import { useCallback, useEffect, useState } from 'react';
import type {
  ClaimEvent,
  ClaimStatus,
  ClaimView,
  Policy,
} from '../shared/contracts.ts';
import { api } from './api.ts';
import { InstructionsDialog } from './InstructionsDialog.tsx';

const money = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    amount,
  );
const labels: Record<ClaimStatus, string> = {
  waiting: 'Waiting',
  in_progress: 'In progress',
  waiting_for_sign_off: 'Waiting for sign-off',
  decided: 'Decided',
};
const show = (value: unknown) =>
  typeof value === 'string' ? value : JSON.stringify(value, null, 2);
const eventNames: Record<string, string> = {
  started: 'Processing started',
  tool_call: 'Tool requested',
  tool_result: 'Tool returned',
  model_message: 'Agent response',
  decision_recorded: 'Decision recorded',
  completed: 'Processing completed',
  failed: 'Processing failed',
  signed_off: 'Handler signed off',
  payment_simulated: 'Payment simulated',
};

export function App() {
  const [claims, setClaims] = useState<ClaimView[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('claim');
  const [handler, setHandler] = useState('');
  const [theme, setTheme] = useState('light');
  const [instructions, setInstructions] = useState<{
    instructions: string;
    policy_wording: string;
  } | null>(null);
  const [context, setContext] = useState<{
    id: string;
    policy: Policy;
    history: ClaimView[];
  } | null>(null);
  const [events, setEvents] = useState<Record<string, ClaimEvent[]>>({});
  const [liveId, setLiveId] = useState('');
  const selected =
    claims.find((view) => view.claim.claim_id === selectedId) ?? claims[0];
  const id = selected?.claim.claim_id;
  const refresh = useCallback(async () => {
    try {
      setClaims(await api<ClaimView[]>('/claims'));
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    }
  }, []);
  useEffect(() => {
    let active = true;
    void api<ClaimView[]>('/claims')
      .then((rows) => {
        if (active) setClaims(rows);
      })
      .catch((error) => {
        if (active)
          setError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!id) return;
    let active = true;
    void (async () => {
      try {
        const view = await api<ClaimView>(`/claims/${id}`);
        const [policy, history] = await Promise.all([
          api<Policy>(`/policies/${view.claim.policy_id}`),
          api<ClaimView[]>(`/claims/${id}/history`),
        ]);
        if (active) setContext({ id, policy, history });
      } catch (error) {
        if (active)
          setError(error instanceof Error ? error.message : String(error));
      }
    })();
    const stream = new EventSource(`/api/claims/${id}/stream`);
    stream.onopen = () => setLiveId(id);
    stream.onerror = () => setLiveId('');
    stream.onmessage = (message) => {
      const event = JSON.parse(message.data) as ClaimEvent;
      setEvents((previous) => {
        const list = previous[id] ?? [];
        return list.some((item) => item.id === event.id)
          ? previous
          : { ...previous, [id]: [...list, event] };
      });
      void refresh();
    };
    return () => {
      active = false;
      stream.close();
    };
  }, [id, refresh]);
  async function action(task: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await task();
      await refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }
  const visible = claims.filter(
    (view) => filter === 'all' || view.status === filter,
  );
  const currentContext = context?.id === id ? context : null;

  return (
    <div className="workspace" data-theme={theme}>
      <header className="topbar">
        <a className="brand" href="/" aria-label="Insurer home">
          <svg width="29" height="32" viewBox="0 0 29 32" aria-hidden="true">
            <path
              d="M2 3 14.5 1 27 3v13c0 7-6 12-12.5 15C8 28 2 23 2 16Z"
              fill="currentColor"
            />
            <path
              d="m8 15 4 4 9-10"
              stroke="white"
              strokeWidth="2.5"
              fill="none"
            />
          </svg>
          insurer<span>Claims workspace</span>
        </a>
        <div className="top-actions">
          <span className="pilot-label">Pilot · simulated payments</span>
          <button
            className="text-button"
            onClick={() =>
              void action(async () =>
                setInstructions(await api('/instructions')),
              )
            }
          >
            Agent instructions
          </button>
          <button
            className="text-button"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            aria-label="Toggle color theme"
          >
            {theme === 'light' ? 'Dark mode' : 'Light mode'}
          </button>
        </div>
      </header>
      <main>
        <div className="page-heading">
          <div>
            <p className="eyebrow">Claims operations</p>
            <h1>Every claim, a clear next step.</h1>
            <p className="subheading">
              Review the evidence, follow the agent, and sign off where it
              matters.
            </p>
          </div>
          <span className="queue-total">
            {claims.length}
            <small>claims in queue</small>
          </span>
        </div>
        {error && (
          <div className="error-banner" role="alert">
            {error}
            <button onClick={() => void refresh()}>Refresh</button>
          </div>
        )}
        <div className="status-overview">
          {(Object.entries(labels) as [ClaimStatus, string][]).map(
            ([status, label]) => (
              <button
                key={status}
                className={filter === status ? 'overview active' : 'overview'}
                onClick={() => setFilter(filter === status ? 'all' : status)}
              >
                <span className={`status-dot ${status}`} />
                <span>{label}</span>
                <strong>
                  {claims.filter((view) => view.status === status).length}
                </strong>
              </button>
            ),
          )}
        </div>
        <div className="case-layout">
          <section className="queue-panel panel" aria-label="Claims queue">
            <div className="panel-heading">
              <h2>Claims queue</h2>
              <label>
                Show
                <select
                  aria-label="Filter claims"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                >
                  <option value="all">All claims</option>
                  {Object.entries(labels).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="queue-list">
              {visible.map((view) => (
                <button
                  key={view.claim.claim_id}
                  className={`queue-item ${id === view.claim.claim_id ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedId(view.claim.claim_id);
                    setTab('claim');
                  }}
                >
                  <div className="queue-line">
                    <span className="identifier">{view.claim.claim_id}</span>
                    <span className="amount">
                      {money(view.claim.amount_claimed)}
                    </span>
                  </div>
                  <h3>{view.claim.summary}</h3>
                  <div className="queue-line">
                    <span className="claim-type">
                      {view.claim.claim_type.replaceAll('_', ' ')}
                    </span>
                    <span className={`badge ${view.status}`}>
                      {labels[view.status]}
                    </span>
                  </div>
                </button>
              ))}
              {!visible.length && (
                <p className="empty-state">No claims in this view.</p>
              )}
            </div>
          </section>
          <section className="case-panel panel" aria-label="Selected claim">
            {selected ? (
              <>
                <div className="case-header">
                  <div className="queue-line">
                    <span className="identifier">{id}</span>
                    <span className={`badge ${selected.status}`}>
                      {labels[selected.status]}
                    </span>
                  </div>
                  <h2>{selected.claim.summary}</h2>
                  <div className="case-amount">
                    <span>Amount claimed</span>
                    <strong>{money(selected.claim.amount_claimed)}</strong>
                  </div>
                  {selected.status === 'waiting' && (
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() =>
                        void action(() =>
                          api(`/claims/${id}/run`, {
                            thread_id: crypto.randomUUID(),
                          }),
                        )
                      }
                    >
                      {selected.error ? 'Retry claim' : 'Run agent'}
                    </button>
                  )}
                  {selected.status === 'in_progress' && (
                    <p className="processing">
                      The agent is reviewing this claim. Follow its steps in
                      Activity.
                    </p>
                  )}
                  {selected.error && (
                    <p className="inline-error" role="status">
                      {selected.error}
                    </p>
                  )}
                </div>
                {selected.decision && (
                  <div
                    className={`decision-card ${selected.decision.decision}`}
                  >
                    <div className="queue-line">
                      <span className="eyebrow">
                        Agent decision · revision {selected.revision}
                      </span>
                      <strong data-testid="decision" className="decision-value">
                        {selected.decision.decision} ·{' '}
                        {money(selected.decision.payout)}
                      </strong>
                    </div>
                    <p>{selected.decision.rationale}</p>
                    {selected.signed_by && (
                      <p className="confirmation">
                        Signed off by {selected.signed_by}
                      </p>
                    )}
                    {selected.paid !== null ? (
                      <p className="confirmation">
                        Payment simulated: {money(selected.paid)}
                      </p>
                    ) : (
                      selected.decision.decision === 'approve' && (
                        <>
                          <p className="payment-note">
                            {selected.status === 'waiting_for_sign_off'
                              ? 'Payment is blocked until a handler signs off.'
                              : 'Payment is recorded only when the simulation succeeds.'}
                          </p>
                          {selected.status === 'waiting_for_sign_off' && (
                            <form
                              onSubmit={(event) => {
                                event.preventDefault();
                                void action(() =>
                                  api(`/claims/${id}/sign-off`, {
                                    handler,
                                    revision: selected.revision,
                                  }),
                                );
                              }}
                            >
                              <label>
                                Handler name
                                <input
                                  aria-label="Handler name"
                                  value={handler}
                                  onChange={(event) =>
                                    setHandler(event.target.value)
                                  }
                                  required
                                />
                              </label>
                              <button className="primary" disabled={busy}>
                                Sign off decision
                              </button>
                            </form>
                          )}
                          <button
                            className="secondary"
                            disabled={
                              busy ||
                              selected.status === 'waiting_for_sign_off' ||
                              selected.status === 'in_progress'
                            }
                            onClick={() =>
                              void action(() =>
                                api(`/claims/${id}/pay`, {
                                  thread_id: selected.run?.thread_id,
                                  amount: selected.decision?.payout,
                                  revision: selected.revision,
                                }),
                              )
                            }
                          >
                            Simulate payment
                          </button>
                        </>
                      )
                    )}
                  </div>
                )}
                <nav className="tabs" aria-label="Claim sections">
                  {[
                    ['claim', 'Claim & documents'],
                    ['activity', 'Activity'],
                    ['policy', 'Policy & history'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      aria-pressed={tab === value}
                      onClick={() => setTab(value)}
                    >
                      {label}
                      {value === 'activity' && (
                        <span>{events[id ?? '']?.length ?? 0}</span>
                      )}
                    </button>
                  ))}
                </nav>
                <div className="case-content">
                  {tab === 'claim' && (
                    <>
                      <h3>Customer’s account</h3>
                      <p className="story">{selected.claim.story}</p>
                      <dl className="facts">
                        {Object.entries(selected.claim)
                          .filter(
                            ([key]) =>
                              ![
                                'story',
                                'documents',
                                'summary',
                                'amount_claimed',
                                'items',
                              ].includes(key),
                          )
                          .map(([key, value]) => (
                            <div key={key}>
                              <dt>{key.replaceAll('_', ' ')}</dt>
                              <dd>{show(value)}</dd>
                            </div>
                          ))}
                      </dl>
                      {selected.claim.items !== undefined && (
                        <details>
                          <summary>Claimed items</summary>
                          <pre>{show(selected.claim.items)}</pre>
                        </details>
                      )}
                      <h3>
                        Attached documents{' '}
                        <span className="muted">
                          ({selected.claim.documents.length})
                        </span>
                      </h3>
                      {selected.claim.documents.map((document, index) => (
                        <details className="document" key={index}>
                          <summary>
                            {document.name}
                            <small>{document.type.replaceAll('_', ' ')}</small>
                          </summary>
                          <p>{document.content}</p>
                        </details>
                      ))}
                      {!selected.claim.documents.length && (
                        <p className="muted">No documents attached.</p>
                      )}
                    </>
                  )}
                  {tab === 'activity' && (
                    <>
                      <div className="queue-line">
                        <h3>Processing history</h3>
                        <span className="live-indicator">
                          {liveId === id ? 'Live updates' : 'Reconnecting…'}
                        </span>
                      </div>
                      <ol className="timeline">
                        {(events[id ?? ''] ?? []).map((event) => (
                          <li key={event.id}>
                            <div className="queue-line">
                              <strong>
                                {eventNames[event.kind] ?? event.kind}
                              </strong>
                              <time>
                                {new Date(
                                  event.created_at,
                                ).toLocaleTimeString()}
                              </time>
                            </div>
                            <details>
                              <summary>View details</summary>
                              <pre>{show(event.data)}</pre>
                            </details>
                          </li>
                        ))}
                      </ol>
                      {!events[id ?? '']?.length && (
                        <p className="empty-state">
                          Run the agent to see its steps here.
                        </p>
                      )}
                      {selected.run?.usage && (
                        <dl className="facts">
                          <div>
                            <dt>Model</dt>
                            <dd>{selected.run.usage.model}</dd>
                          </div>
                          <div>
                            <dt>Cost</dt>
                            <dd>
                              {selected.run.usage.cost === null
                                ? 'Unknown'
                                : `$${selected.run.usage.cost.toFixed(4)}`}
                            </dd>
                          </div>
                          <div>
                            <dt>Elapsed</dt>
                            <dd>
                              {selected.run.usage.seconds.toFixed(1)} seconds
                            </dd>
                          </div>
                        </dl>
                      )}
                    </>
                  )}
                  {tab === 'policy' && (
                    <>
                      {currentContext ? (
                        <>
                          <h3>Customer policy</h3>
                          <pre className="record">
                            {show(currentContext.policy)}
                          </pre>
                          <h3>Other claims for this customer</h3>
                          {currentContext.history.length ? (
                            currentContext.history.map((view) => (
                              <div
                                className="history-item"
                                key={view.claim.claim_id}
                              >
                                <strong>{view.claim.claim_id}</strong>
                                <p>{view.claim.summary}</p>
                                <span>
                                  {view.decision
                                    ? `${view.decision.decision} · ${money(view.decision.payout)}`
                                    : labels[view.status]}
                                </span>
                              </div>
                            ))
                          ) : (
                            <p className="muted">No other claims on record.</p>
                          )}
                        </>
                      ) : (
                        <p className="muted">Loading policy and history…</p>
                      )}
                    </>
                  )}
                </div>
              </>
            ) : (
              <p className="empty-state">Loading the claims queue…</p>
            )}
          </section>
        </div>
        <footer>
          Insurer pilot · Amounts in US dollars · No real payments or customer
          messages
        </footer>
      </main>
      {instructions && (
        <InstructionsDialog
          instructions={instructions}
          onClose={() => setInstructions(null)}
        />
      )}
    </div>
  );
}
