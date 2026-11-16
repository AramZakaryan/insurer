import { DatabaseSync } from 'node:sqlite';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { claimSchema, policySchema } from '../shared/contracts.ts';
import type {
  Claim,
  ClaimEvent,
  ClaimStatus,
  ClaimView,
  Decision,
  Policy,
  RunRecord,
  RunUsage,
} from '../shared/contracts.ts';
import { instructions } from './instructions.ts';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
interface ClaimRow {
  payload: string;
  status: ClaimStatus;
  decision: string | null;
  revision: number;
  payout_cents: number;
  signed_revision: number | null;
  signed_by: string | null;
  paid_cents: number | null;
  thread_id: string | null;
  error: string | null;
}
export class Store {
  readonly events = new EventEmitter();
  readonly db: DatabaseSync;
  readonly wording: string;
  constructor(filename: string, seedDir: string) {
    this.db = new DatabaseSync(filename);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS policies(id TEXT PRIMARY KEY, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS claims(id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'waiting', decision TEXT, revision INTEGER NOT NULL DEFAULT 0,
        payout_cents INTEGER NOT NULL DEFAULT 0, signed_revision INTEGER, signed_by TEXT, paid_cents INTEGER, thread_id TEXT, error TEXT);
      CREATE TABLE IF NOT EXISTS runs(thread_id TEXT PRIMARY KEY, claim_id TEXT NOT NULL REFERENCES claims(id), status TEXT NOT NULL, usage TEXT);
      CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY AUTOINCREMENT, claim_id TEXT NOT NULL REFERENCES claims(id), thread_id TEXT NOT NULL, kind TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS settings(id TEXT PRIMARY KEY, value TEXT NOT NULL);`);
    const seeded = this.db
      .prepare("SELECT value FROM settings WHERE id='seeded'")
      .get();
    if (!seeded) {
      const claims = z
        .array(claimSchema)
        .parse(JSON.parse(readFileSync(join(seedDir, 'claims.json'), 'utf8')));
      const policies = z
        .array(policySchema)
        .parse(
          JSON.parse(readFileSync(join(seedDir, 'policies.json'), 'utf8')),
        );
      const wording = readFileSync(join(seedDir, 'policy_wording.md'), 'utf8');
      this.transaction(() => {
        for (const policy of policies)
          this.db
            .prepare('INSERT INTO policies VALUES(?,?)')
            .run(policy.policy_id, JSON.stringify(policy));
        for (const claim of claims) {
          if (
            !policies.some(
              (policy) =>
                policy.policy_id === claim.policy_id &&
                policy.customer_id === claim.customer_id,
            )
          )
            throw new Error(`No matching policy for ${claim.claim_id}`);
          this.db
            .prepare('INSERT INTO claims(id,customer_id,payload) VALUES(?,?,?)')
            .run(claim.claim_id, claim.customer_id, JSON.stringify(claim));
        }
        this.db
          .prepare('INSERT INTO settings VALUES(?,?)')
          .run('wording', wording);
        this.db.prepare('INSERT INTO settings VALUES(?,?)').run('seeded', '1');
      });
    }
    this.wording = (
      this.db
        .prepare("SELECT value FROM settings WHERE id='wording'")
        .get() as { value: string }
    ).value;
    // A process restart cannot resume an in-memory model invocation.
    for (const row of this.db
      .prepare("SELECT claim_id,thread_id FROM runs WHERE status='running'")
      .all() as { claim_id: string; thread_id: string }[])
      this.fail(
        row.claim_id,
        row.thread_id,
        'Processing interrupted by a server restart. You can retry claims without a recorded decision.',
      );
  }
  close() {
    this.db.close();
  }
  transaction<T>(action: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = action();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  row(id: string): ClaimRow {
    const row = this.db
      .prepare('SELECT * FROM claims WHERE id=?')
      .get(id) as unknown as ClaimRow | undefined;
    if (!row) throw new ApiError(404, `Claim ${id} not found.`);
    return row;
  }
  detail(id: string): ClaimView {
    const row = this.row(id);
    const run = row.thread_id
      ? (this.db
          .prepare('SELECT thread_id,status,usage FROM runs WHERE thread_id=?')
          .get(row.thread_id) as {
          thread_id: string;
          status: RunRecord['status'];
          usage: string | null;
        })
      : null;
    return {
      claim: JSON.parse(row.payload) as Claim,
      status: row.status,
      decision: row.decision ? (JSON.parse(row.decision) as Decision) : null,
      revision: row.revision,
      signed_by: row.signed_by,
      paid: row.paid_cents === null ? null : row.paid_cents / 100,
      error: row.error,
      run: run
        ? {
            ...run,
            usage: run.usage ? (JSON.parse(run.usage) as RunUsage) : null,
          }
        : null,
    };
  }
  list() {
    return (
      this.db.prepare('SELECT id FROM claims ORDER BY id').all() as {
        id: string;
      }[]
    ).map((row) => this.detail(row.id));
  }
  policy(id: string): Policy {
    const row = this.db
      .prepare('SELECT payload FROM policies WHERE id=?')
      .get(id) as { payload: string } | undefined;
    if (!row) throw new ApiError(404, `Policy ${id} not found.`);
    return JSON.parse(row.payload) as Policy;
  }
  history(id: string) {
    const { claim } = this.detail(id);
    return this.list().filter(
      (view) =>
        view.claim.customer_id === claim.customer_id &&
        view.claim.claim_id !== id,
    );
  }
  instructions() {
    return { instructions, policy_wording: this.wording };
  }
  log(id: string, thread: string, kind: string, data: unknown) {
    const created_at = new Date().toISOString();
    const result = this.db
      .prepare(
        'INSERT INTO events(claim_id,thread_id,kind,data,created_at) VALUES(?,?,?,?,?)',
      )
      .run(id, thread, kind, JSON.stringify(data), created_at);
    const event: ClaimEvent = {
      id: Number(result.lastInsertRowid),
      claim_id: id,
      thread_id: thread,
      kind,
      data,
      created_at,
    };
    this.events.emit(id, event);
    return event;
  }
  eventList(id: string) {
    this.row(id);
    return (
      this.db
        .prepare('SELECT * FROM events WHERE claim_id=? ORDER BY id')
        .all(id) as unknown as (Omit<ClaimEvent, 'data'> & { data: string })[]
    ).map((row) => ({ ...row, data: JSON.parse(row.data) as unknown }));
  }
  active(id: string, thread: string, running = true) {
    const row = this.row(id);
    const run = this.db
      .prepare('SELECT claim_id,status FROM runs WHERE thread_id=?')
      .get(thread) as { claim_id: string; status: string } | undefined;
    if (
      !run ||
      run.claim_id !== id ||
      row.thread_id !== thread ||
      (running && run.status !== 'running')
    )
      throw new ApiError(409, 'This run is not active for this claim.');
    return row;
  }
  begin(id: string, thread: string) {
    const created = this.transaction(() => {
      const existing = this.db
        .prepare('SELECT claim_id FROM runs WHERE thread_id=?')
        .get(thread) as { claim_id: string } | undefined;
      if (existing) {
        if (existing.claim_id !== id)
          throw new ApiError(409, 'Thread belongs to another claim.');
        return false;
      }
      if (this.row(id).status !== 'waiting')
        throw new ApiError(409, 'Claim is already processing or decided.');
      this.db
        .prepare(
          "INSERT INTO runs(thread_id,claim_id,status) VALUES(?,?,'running')",
        )
        .run(thread, id);
      this.db
        .prepare(
          "UPDATE claims SET status='in_progress',thread_id=?,error=NULL WHERE id=?",
        )
        .run(thread, id);
      return true;
    });
    if (created)
      this.log(id, thread, 'started', {
        message: 'Agent started processing the claim.',
      });
    return { created, claim: this.detail(id) };
  }
  record(id: string, thread: string, decision: Decision) {
    if (decision.decision !== 'approve' && decision.payout !== 0)
      throw new ApiError(422, 'Declines and referrals must have zero payout.');
    this.transaction(() => {
      const row = this.active(id, thread);
      if (row.paid_cents !== null)
        throw new ApiError(409, 'A paid decision cannot be changed.');
      this.db
        .prepare(
          'UPDATE claims SET decision=?,payout_cents=?,revision=revision+1,signed_revision=NULL,signed_by=NULL WHERE id=?',
        )
        .run(JSON.stringify(decision), Math.round(decision.payout * 100), id);
    });
    this.log(id, thread, 'decision_recorded', decision);
    return this.detail(id);
  }
  finish(id: string, thread: string, usage: RunUsage) {
    const row = this.active(id, thread);
    if (!row.decision)
      throw new ApiError(422, 'Agent finished without recording a decision.');
    this.transaction(() => {
      this.db
        .prepare("UPDATE runs SET status='completed',usage=? WHERE thread_id=?")
        .run(JSON.stringify(usage), thread);
      this.db
        .prepare('UPDATE claims SET status=? WHERE id=?')
        .run(this.decidedStatus(row), id);
    });
    this.log(id, thread, 'completed', {
      message: 'Processing completed.',
      usage,
    });
    return this.detail(id);
  }
  decidedStatus(row: ClaimRow): ClaimStatus {
    return row.decision &&
      row.payout_cents > 100000 &&
      row.signed_revision !== row.revision
      ? 'waiting_for_sign_off'
      : 'decided';
  }
  fail(id: string, thread: string, error: string) {
    const row = this.active(id, thread);
    this.transaction(() => {
      this.db
        .prepare("UPDATE runs SET status='failed' WHERE thread_id=?")
        .run(thread);
      this.db
        .prepare('UPDATE claims SET status=?,error=? WHERE id=?')
        .run(row.decision ? this.decidedStatus(row) : 'waiting', error, id);
    });
    this.log(id, thread, 'failed', { message: error });
    return this.detail(id);
  }
  signOff(id: string, handler: string, revision: number) {
    const row = this.row(id);
    if (row.status !== 'waiting_for_sign_off' || row.revision !== revision)
      throw new ApiError(409, 'No matching decision is waiting for sign-off.');
    this.db
      .prepare(
        "UPDATE claims SET signed_revision=?,signed_by=?,status='decided' WHERE id=?",
      )
      .run(revision, handler, id);
    this.log(id, row.thread_id ?? '', 'signed_off', { handler, revision });
    return this.detail(id);
  }
  pay(id: string, thread: string, amount: number, revision: number) {
    this.transaction(() => {
      const row = this.active(id, thread, false);
      const decision = row.decision
        ? (JSON.parse(row.decision) as Decision)
        : null;
      const cents = Math.round(amount * 100);
      if (!decision || decision.decision !== 'approve')
        throw new ApiError(409, 'Only approved claims can be paid.');
      if (revision !== row.revision || cents !== row.payout_cents)
        throw new ApiError(
          409,
          'Payment must match the current decision and amount.',
        );
      if (cents > 100000 && row.signed_revision !== revision)
        throw new ApiError(
          409,
          'Handler sign-off is required before this payment.',
        );
      if (row.paid_cents !== null) return;
      this.db
        .prepare('UPDATE claims SET paid_cents=? WHERE id=?')
        .run(cents, id);
      this.log(id, thread, 'payment_simulated', { amount, revision });
    });
    return this.detail(id);
  }
}
