# onerule

TypeScript CLI, Node 22+, ESM, no runtime dependencies.

- `src/sync.ts` holds the target table and all file logic. `src/cli.ts` only parses args and prints.
- Functions take a root directory. Tests run against temp dirs; never touch the real repo from a test.
- Imports use `.ts` extensions; `tsc` rewrites them on build.
- Run `npm run typecheck && npm test` before committing.
- No code comments. Keep output lines short and grep-friendly.
- Conventional commits: `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `ci:`.
- After editing this file run `node src/bin.ts sync --apply`; CI runs `check`.
