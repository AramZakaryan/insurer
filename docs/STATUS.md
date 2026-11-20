# Status

The claims pilot is implemented locally.

- Express and SQLite import only `claims.json`, `policies.json` and `policy_wording.md`. Restarting does not overwrite records or duplicate the queue.
- The policy wording source and agent instructions use the name `Insurer`. Existing seeded databases retain their stored wording until explicitly updated.
- API operations have an `operation_id`, a one-line description and required, validated inputs. The catalog is at `/api/operations`.
- Decisions, approval revisions, simulated payments, run usage and activity are persisted. Amounts are stored in cents.
- Payments over $1,000 are blocked until a handler signs off the current decision. Wrong amounts/revisions, repeated payment and cross-claim run access are covered by tests.
- Backend and agent run as separate Node.js processes. Backend dispatches to `POST /runs` and the agent uses the backend HTTP API for claims, tools and events. It reads facts and instructions through HTTP and has no filesystem/data loader tool. Model names come from `MODEL_NAME`, defaulting to Luna at low effort.
- Claim states are waiting, in progress, waiting for sign-off and decided. SSE replays saved events and delivers live updates. Interrupted runs are marked failed on restart; undecided claims can be retried.
- The React interface includes the queue and filters, claim/documents, customer policy/history, decisions, sign-off, simulated payments, activity and read-only instructions. The brand supports light/dark themes and mobile layouts.
- Unit and API/agent integration tests use synthetic fixtures and a stub model. Playwright covers the complete workflow, blocked large payouts, declines/referrals, failure/retry and mobile overflow.
- An isolated evaluator reports accuracy, payouts within $1, difficulty groups, time and billing. Reference answers are never provided to the backend or agent. Live model accuracy and actual model costs have not been measured.
- ESLint, Prettier, Husky and lint-staged remain enabled. Node 26 is the target runtime, TypeScript 6.0.3 remains strict, and `npm run check` includes the frontend build and browser tests.

The supplied records contain no separate customer or handler files. Customer history comes from claims sharing a customer ID; handler names are entered manually. Automatic continuation after a process restart, sign-in, the claims manual, real payments and customer messages are not implemented.

The current architecture and workflow diagrams are in [`.agents/diagrams`](../.agents/diagrams/README.md).

## Verification

On Node 26.13.1, `npm run check` passes formatting, lint, strict types, 17 unit/integration tests, the production frontend build and 5 Playwright scenarios. Source-data smoke checking loads 25 claims and 50 policies without evaluation records. Desktop, dark-theme and mobile screenshots were inspected. No paid evaluation has been run.
