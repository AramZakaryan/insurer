# Tech stack

- Node 26, TypeScript 6.0.3 in strict mode, ES modules, `tsx` for server execution.
- `backend/`: Express and SQLite through `node:sqlite`. API operations have an `operation_id`, one-line description and required inputs. Recording a decision, handler sign-off and paying an amount are separate operations. The API catalog is at `/api/operations`.
- `agent/`: LangChain `createAgent` with `ChatOpenAI` on OpenRouter. The entry point is `run(claim_id, thread_id)`. Tools reach records and instructions only through the backend API. The default model is `openai/gpt-6-luna`, at low reasoning effort, overridden by `MODEL_NAME`.
- `frontend/`: React, Vite and TypeScript; built-in fetch and EventSource for HTTP and SSE. CSS follows `BRAND.md`; Google Fonts have local system fallbacks.
- `shared/`: Zod schemas and TypeScript contracts.
- `tests/`: `node:test`, synthetic fixtures, stub model, HTTP integration tests and real SQLite files/in-memory databases.
- `e2e/`: Playwright with Chromium, a temporary database, synthetic records and the stub model. No paid requests.
- `data/`: explicit backend seed files. `data/evals/` is read only by the separate evaluation command and is never exposed through the API, static hosting or model inputs.
- `outputs/`: ignored SQLite database and evaluation reports. Built frontend assets are in ignored `dist/frontend/`.

The OpenRouter key is `OPENROUTER_API_KEY` in `.env`. It is never supplied to Vite or browser code. `PORT` defaults to 3001. `DATABASE_PATH` and `SEED_DIR` may override backend storage and seed locations for isolated tests. `PILOT_STUB=1` is accepted only with `NODE_ENV=test`.

## Code checks

ESLint uses recommended JavaScript/TypeScript rules and React Hooks/Refresh rules. Explicit `any` is prohibited; warnings fail lint checks. Prettier owns formatting. Husky runs lint-staged, type checking, tests, the build and Playwright before committing. All npm scripts use `.mjs` launchers for Windows compatibility. No containers are required.
