# Changelog

## 0.1.1

- Targets that are symlinks or hard links are replaced with a regular file instead of written through, so a `CLAUDE.md` linked to `AGENTS.md` no longer wipes `AGENTS.md`
- Existing content counts as already in the source only when every line matches, not when it is a substring
- A UTF-8 BOM in `onerule.json` or instruction files is ignored
- `source` must be a path inside the repo; a `null` or non-object `onerule.json` is a clear error

## 0.1.0

- `init`, `status`, `sync`, `check`
- Targets: `CLAUDE.md` and `GEMINI.md` as imports; `.github/copilot-instructions.md`, `.cursor/rules/onerule.mdc` and `AGENTS.md` as generated copies
