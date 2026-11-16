# Status

The existing claims CLI is migrated to TypeScript with strict type checking.

- Application modules, chart/table scripts and tests use `.ts` files.
- `npm start` runs the LangChain agent on the first claim through OpenRouter.
- The agent retrieves the policy and records its decision through tools. Recorded decisions are printed and saved to ignored `recorded.json`.
- Direct model and Jev evaluation helpers, score summaries and local charts remain available.
- `npm run typecheck` checks types; `npm test` runs mocked tests without paid model calls.
- Development instructions cover individual changes without requiring a separate plan file.

The backend, frontend, database and end-to-end pilot described in the specification are not built yet.
