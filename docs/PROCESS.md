## Implementing

For each requested change:

1. Build it, with tests.
2. Check every success criterion and fix whatever fails.
3. Update `docs/STATUS.md`.
4. Commit only when explicitly authorized. The pre-commit hook runs the checks; if it fails, fix the problem before committing.

When the change is done, run `npm run test` and report the results.

## Rules

- Add tests with each change. Tests never call a model; use a stub model.
- Check each change before requesting commit approval.
- Run `npm run test` before you hand work over.
- Never use `git commit --no-verify`.
- Never lower a threshold, turn off a rule or exclude a file to get a green run. If a rule looks wrong, stop and ask.
- Keep `docs/STATUS.md` up to date.
- Never push.
- Don't open `data/evals/` unless you're asked to.
- Everything must work on Windows: write `package.json` scripts as `uv run` commands or `.mjs` files.
