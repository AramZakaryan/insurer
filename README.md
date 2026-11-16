# insurer

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

This runs the LangChain claims agent on the first sample claim using `openai/gpt-6-luna` at low effort through OpenRouter. The agent can retrieve the customer's policy and record its decision through tools. The application prints the message history and recorded decisions and saves a snapshot to the ignored `recorded.json` file. A run can make multiple paid model requests.

Direct LLM and Jev evaluation helpers remain available in their modules; they are not the default `npm start` workflow. See [SPEC.md](docs/SPEC.md) for scoring rules and current limitations.

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

## LangChain chat example

Run `npm start` (or `npm run langchain`) to run the claims agent on the first claim and print its message history, excluding the initial user message. `langchain-chat.js` configures and exports `llm`. `agent.js` creates the agent with Luna at low effort, the two claims tools, and `AGENT_SYSTEM_PROMPT`. `index.js` calls `agent.invoke` with `makeClaimPrompt(claims[0])` and prints model messages, tool calls, tool results, and the final answer. The agent uses the existing `OPENROUTER_API_KEY` and paid Luna model. The separate `llm` export retains `openrouter/free` for standalone experiments. Node.js 22 or newer is required by the LangChain integration.

## Claims tools

`tools.js` exports LangChain tools `getPolicy` (`get_policy`) and `recordDecision` (`record_decision`), a `tools` array for an agent, and the in-memory `recorded` object.

```js
import { getPolicy, recordDecision, recorded } from './tools.js';

console.log(await getPolicy.invoke({ policy_id: 'POL-001' }));
await recordDecision.invoke({
  claim_id: 'CLM-1001',
  decision: 'approve',
  payout: 420,
  rationale: 'The claim is covered under section 3.',
});
console.log(recorded['CLM-1001']);
```

Use a policy ID from `data/policies.json`. Recording the same claim again overwrites its entry. `index.js` saves the full `recorded` object as formatted UTF-8 JSON in `recorded.json` after a successful agent run. The file is ignored by Git and is overwritten by the next successful run; it can be opened after Node.js exits. The Zod schema validates argument types and decision options; the payout and rationale rules in the descriptions guide the model but are not additional business-rule checks. The agent in `agent.js` uses both tools.

## Project documentation

Start with [AGENTS.md](AGENTS.md) for the documentation map and agent instructions. Detailed references: [specification](docs/SPEC.md), [stack](docs/TECH_STACK.md), [code standards](docs/CODE_STANDARDS.md), [process](docs/PROCESS.md), [status](docs/STATUS.md), and [brand](docs/BRAND.md).
