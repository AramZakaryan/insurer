# Business records

The supplied pilot records are synthetic travel insurance examples:

- `claims.json`: the working queue, stories, claimed amounts, item details and attached document text.
- `policies.json`: policy records, customer IDs, plans, add-ons, travelers and trips.
- `policy_wording.md`: coverage, exclusions, limits and payout rules used by the agent.

The backend imports only these three named files into SQLite on first start. It does not scan this directory recursively. The source records are never served as static files.

`evals/` contains reference decisions and held-out evaluation records. Only `npm run evaluate` reads these; the working queue and model inputs exclude them. No separate customers, handlers, structured plans or claims manual files are included in the supplied dataset.
