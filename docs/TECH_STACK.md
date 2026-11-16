# Tech stack

- `backend/`: express and SQLite. Every API operation has an `operation_id`, a one-line docstring and no optional inputs. Paying a claim is a separate operation that takes the amount.
- `agent/`: LangChain's `create_agent` on OpenRouter, with one entry point that takes a claim id and a thread id. It reaches claims and its instructions only through the backend's API. It uses `openai/gpt-6-luna` with low reasoning effort by default, or the model in the environment variable `MODEL_NAME` if set, such as `openrouter/free`.
- `frontend/`: React, Vite and TypeScript.
- `e2e/`: Playwright tests.
- `data/`: the business data the backend starts from. The agent never sees `data/evals/`, which holds the answer key.


Node 26. The OpenRouter key is `OPENROUTER_API_KEY` in `.env`.

## Current implementation

The current CLI uses TypeScript in strict mode, executed through `tsx`. Run `npm run typecheck` for static checks and `npm test` for mocked tests. The backend, frontend and e2e directories above describe the planned pilot architecture.
