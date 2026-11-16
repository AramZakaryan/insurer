# Code standards

1. Keep it simple, do not overcomplicate.
2. Comments only when necessary. Explain why, not what the code already says.
3. Be concise: a short README and no emojis.
4. IMPORTANT: avoid overly defensive code. Handle exceptions only when necessary.
5. TypeScript: strict mode, never `any`.
6. Keep responsibilities separate: data loading, policies, prompts, tools, and agent composition belong in their respective modules.
7. Keep secrets in `.env`. Never log credentials or commit secrets and generated outputs.
