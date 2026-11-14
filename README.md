# simple_langchain_project

Node.js ES modules project for evaluating travel insurance claim decisions through OpenRouter using its OpenAI-compatible API.

## Setup

```sh
npm install
cp .env.example .env
```

Add your OpenRouter API key to `OPENROUTER_API_KEY` in `.env`. The file is ignored by Git. Existing `.env` files do not need to be replaced.

## Run

```sh
npm start
```

This evaluates all 25 claims sequentially with `openai/gpt-6-luna` at low and medium effort, and `google/gemini-3.5-flash-lite` at low effort (75 paid API requests). Each response must match the `ClaimDecision` Zod schema. Malformed JSON, schema mismatches, and truncated responses are retried up to three attempts per claim. Retry warnings include the claim ID and model. Refusals and unexpected finish reasons stop immediately; API failures retain the SDK’s existing retry policy. Exhausted attempts stop with a clear error. Retries can add paid requests beyond the initial 75.

The console shows accuracy by difficulty and totals by model and effort. A decision is correct when its decision matches the reference label and its payout differs by at most $1. Reference decisions are used for scoring only; they are not sent to the model.

Results include the number of attempts, input/output token counts, and the cost reported by OpenRouter, summed across all received attempts (including invalid responses). If cost is absent, results report `cost: null` / `unknown cost`.

```sh
npm run chart
npm run table
```

These commands display the local claims data in a browser without calling the API. Generated files are written to the ignored `outputs/` directory.
