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

This evaluates all 25 claims with `openai/gpt-6-luna` at low effort and Jev (50 paid requests before any LLM retries). The first Jev result is printed and reused in the full evaluation. Luna medium and Gemini examples remain commented out in `index.js`. Each response must match the `ClaimDecision` Zod schema. Malformed JSON, schema mismatches, and truncated responses are retried up to three attempts per claim. Retry warnings include the claim ID and model. Refusals and unexpected finish reasons stop immediately; API failures retain the SDK’s existing retry policy. Exhausted attempts stop with a clear error. Retries can add paid requests beyond the initial 50.

The active run prints decision-only accuracy for Jev and Luna, plus Jev totals and a confidence table (`confidence >= 0.9`). In that table, `sum` is the number of correct decisions and `count` is the number of claims in the group. The commented comparison code shows accuracy by difficulty and totals by model and effort. A decision is correct when its decision matches the reference label and its payout differs by at most $1. Reference decisions are used for scoring only; they are not sent to the model.

Results include the number of attempts, input/output token counts, and the cost reported by OpenRouter, summed across all received attempts (including invalid responses). If cost is absent, results report `cost: null` / `unknown cost`.

```sh
npm run chart
npm run table
```

These commands display the local claims data in a browser without calling the API. Generated files are written to the ignored `outputs/` directory.

## Jev decisions

`jev.js` exports `JEV`, `JEV_QUESTION`, and `decideWithJev`. It uses the official `@openrouter/sdk` and the same `OPENROUTER_API_KEY`, with a 60-second timeout. Jev calls the separate Decisions endpoint, not Chat Completions.

```js
import { getSampleData } from './data.js';
import { decideWithJev } from './jev.js';

const { claims, labels } = getSampleData();
const first = await decideWithJev(claims[0], labels);
console.log(first);
```

Results contain `claim_id`, `decision`, `confidence`, `right`, `cost`, and `seconds`. Correctness compares only the decision, since Jev does not generate a payout or rationale. Pass the matching labels when using tiny or held-out data. Reference labels are never sent to Jev. Importing the function does not send a request; the example makes one paid request when executed.

Model: `typesafe/jev-1.13`, as used in the course. See [OpenRouter's Jev documentation](https://openrouter.ai/docs/guides/community/jev).
