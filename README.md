# Insurer

A travel claims pilot with an Express/SQLite backend, a LangChain agent on OpenRouter, and a React interface. Payments are simulated; approvals over $1,000 require a handler's sign-off enforced by the backend.

## Start

Use Node 26 (`nvm use` when available).

```sh
nvm install
nvm use
npm install
```

Copy `.env.example` to `.env` and set `OPENROUTER_API_KEY`. Set `MODEL_NAME` to override the default Luna model at low effort. Set the key in the agent environment. Agent runs make paid model requests; opening the interface does not.

```sh
npm run dev
```

Open http://127.0.0.1:5173. The backend listens on port 3001 and the agent on 3002. To serve the built interface from the backend:

```sh
npm run build
npm start
```

Open http://127.0.0.1:3001. SQLite lives in the ignored `outputs/insurer.sqlite`; decisions, payment simulations and activity survive a restart. An interrupted run is marked failed, and claims without a recorded decision can be retried. Thread IDs identify runs; automatic resumption of interrupted model execution is not implemented.

Run the services independently in separate terminals with `npm run start:backend` and `npm run start:agent`. By default they use loopback. Set `AGENT_URL` on the backend and `BACKEND_URL` on the agent to point to the other service. Use `BACKEND_HOST` and `AGENT_HOST` to bind to a private network when running on different hosts. The pilot APIs assume a trusted network.

## Checks

Install the test browser once:

```sh
npm run browsers
npm run check
```

The combined check runs Prettier, ESLint, strict type checking, unit/integration tests, the frontend build and Playwright. Tests use a stub model, synthetic records and a temporary database; they never call OpenRouter. Individual commands: `npm run lint`, `npm run format`, `npm run typecheck`, `npm test`, and `npm run e2e` (after building).

Husky installs the pre-commit hook during `npm install`. It formats/lints staged files, then checks types, runs tests, builds the frontend and runs Playwright. A failing step blocks the commit.

## Setup

Use Node 26 (`nvm install` and `nvm use` read `.nvmrc`). Install dependencies with `npm install`, copy `.env.example` to `.env` if it does not exist, and set `OPENROUTER_API_KEY`. Install the test browser once with `npm run browsers`.

Run `npm run dev` and open `http://127.0.0.1:5173`. For the built app, run `npm run build` followed by `npm start`, then open `http://127.0.0.1:3001`.

SQLite is stored in ignored `outputs/insurer.sqlite`. Restarting retains decisions and payments. Tests and evaluations use separate temporary databases.

## Evaluation

These commands make paid requests and run the actual agent against reference answers in an isolated temporary database:

```sh
npm run evaluate
npm run evaluate -- --held-out
```

Only the evaluator reads `data/evals/`. Reference answers never enter the backend database, agent tools or prompts. Results are saved under ignored `outputs/`, with decision accuracy, decision-and-payout accuracy (within $1), difficulty groups, time and cost. Missing cost is reported as unknown. No live accuracy benchmark has been run as part of implementation.

## Structure

- `backend/`: explicit seed import, SQLite, business rules and API operations.
- `agent/`: HTTP endpoint `POST /runs` and tools that access records/instructions through HTTP.
- `frontend/`: queue, full claim/documents, policy/history, activity, sign-off and read-only instructions.
- `shared/`: typed contracts and request schemas.
- `tests/`, `e2e/`: mocked integration tests and Playwright scenarios.
- `scripts/`: portable command runner, development launcher and isolated evaluator.
- `data/`, `docs/`: source records and project documentation.

API operations and required body schemas are available at `/api/operations`. All POST inputs are required and validated. The pilot has no sign-in, real payments or customer messaging. Handler names are entered manually; the pilot does not verify identities.

See [AGENTS.md](AGENTS.md), [specification](docs/SPEC.md), [stack](docs/TECH_STACK.md), [status](docs/STATUS.md) and [brand](docs/BRAND.md).
