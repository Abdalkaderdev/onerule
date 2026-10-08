# onerule

[![CI](https://github.com/Abdalkaderdev/onerule/actions/workflows/ci.yml/badge.svg)](https://github.com/Abdalkaderdev/onerule/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/onerule)](https://www.npmjs.com/package/onerule)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

One `AGENTS.md`. `CLAUDE.md`, `GEMINI.md`, Cursor rules and Copilot instructions kept in sync with it, and a `check` that fails CI when they drift.

```sh
npx onerule init --apply
npx onerule check
```

## Why

Every coding agent wants its own instructions file. Claude Code reads `CLAUDE.md`, Gemini CLI reads `GEMINI.md`, Copilot reads `.github/copilot-instructions.md`, Cursor reads `.cursor/rules/*.mdc`, and Codex and a growing list of others read `AGENTS.md`. Teams copy the same text into four places, edit one, and the rest go stale without anyone noticing.

Most of these tools can now follow a reference to another file, so most of the copies are unnecessary. onerule writes a one-line import where the tool supports it, a generated copy only where it doesn't, and checks both.

## How it differs

There are two established tools in this space. Both are broader than onerule; pick them if you need what they cover.

|                              | onerule                                  | [rulesync](https://github.com/dyoshikawa/rulesync)          | [ruler](https://github.com/intellectronica/ruler)       |
|------------------------------|------------------------------------------|-------------------------------------------------------------|---------------------------------------------------------|
| Source of truth              | your existing `AGENTS.md` (or any file)  | `.rulesync/` directory + `rulesync.jsonc`                    | `.ruler/` directory + `ruler.toml`                      |
| How `CLAUDE.md` is produced  | `@AGENTS.md` import line                 | generated file                                              | generated file (concatenated rules)                     |
| Scope                        | project instruction files, 5 targets     | rules, MCP, commands, subagents, skills, hooks; 30+ tools   | rules, MCP, skills, subagents; 30+ agents               |
| CI drift check               | `onerule check`                          | `rulesync generate --check`                                 | none documented (`apply --dry-run` previews)            |
| Edits `.gitignore`           | no                                       | on request (`rulesync gitignore`)                           | yes by default                                          |
| Runtime dependencies         | 0                                        | 19                                                          | 4                                                       |

Checked against each project's README and `package.json` in October 2026.

The difference is the approach, not the feature count:

- No new directory or DSL. `AGENTS.md` is already an open format read by Codex, Cursor, Copilot and others; onerule keeps it as the file you edit.
- Pointers before copies. `CLAUDE.md` and `GEMINI.md` become import files that can't go stale, so editing `AGENTS.md` needs no sync step for those tools.
- Hand-written files are never overwritten without `--force`. Existing `CLAUDE.md` content is kept below the import.

## Features

- `init` finds the instruction files you already have and merges them into one source
- `sync` writes imports and copies, dry run unless `--apply`
- `check` exits 1 on any drift, for CI and pre-commit hooks
- `status` shows every target and how it's wired
- Generated copies carry a "do not edit" header naming the source
- CRLF checkouts don't count as drift
- No runtime dependencies, one optional 4-line config file

## Quick start

Requires Node 22+.

```sh
cd your-repo
npx onerule init            # preview
npx onerule init --apply    # write
git add -A && git commit -m "chore: single source for agent instructions"
```

From then on, edit `AGENTS.md` and run `npx onerule sync --apply`. Add `npx onerule check` to CI.

## Examples

Output below is from a scratch repo that had a `CLAUDE.md` and a `.github/copilot-instructions.md` with different content.

### `init`

```
$ npx onerule init --apply
create    AGENTS.md (merging CLAUDE.md, .github/copilot-instructions.md)
create    onerule.json (targets: claude, gemini, copilot)
drifted   CLAUDE.md                        Claude Code     content already in AGENTS.md, replace with @AGENTS.md
missing   GEMINI.md                        Gemini CLI
drifted   .github/copilot-instructions.md  GitHub Copilot  merged into AGENTS.md

Done. Edit AGENTS.md, then run: npx onerule sync --apply
```

The result:

```
$ cat AGENTS.md
# Acme API

- Use pnpm, not npm.
- Run `pnpm test` before committing.

## From .github/copilot-instructions.md

Prefer small PRs. Never edit generated files under src/gen/.

$ cat CLAUDE.md
@AGENTS.md

$ cat GEMINI.md
@./AGENTS.md

$ head -1 .github/copilot-instructions.md
<!-- onerule: generated from AGENTS.md. Edit AGENTS.md, then run: npx onerule sync --apply -->
```

Without `--source`, init uses `AGENTS.md`, merging in every other root instruction file whose content it doesn't already contain. Identical copies are merged once. `init --source CLAUDE.md` keeps `CLAUDE.md` as the source and makes `AGENTS.md` a generated copy instead. `--targets claude,copilot` picks targets.

### `status`

```
$ npx onerule status
source    AGENTS.md
ok        CLAUDE.md                        Claude Code     imports AGENTS.md
ok        GEMINI.md                        Gemini CLI      imports AGENTS.md
ok        .github/copilot-instructions.md  GitHub Copilot  copy of AGENTS.md
```

### `check`

After adding a line to `AGENTS.md`:

```
$ npx onerule check
drifted   .github/copilot-instructions.md  GitHub Copilot  stale copy of AGENTS.md

1 of 3 targets out of sync. Run: npx onerule sync --apply
$ echo $?
1
```

Only the copy drifted. The import files already see the new line.

### `sync`

```
$ npx onerule sync
drifted   .github/copilot-instructions.md  GitHub Copilot  stale copy of AGENTS.md

1 to write, 0 conflicts, 2 in sync
Dry run. Re-run with --apply to write.

$ npx onerule sync --apply
drifted   .github/copilot-instructions.md  GitHub Copilot  stale copy of AGENTS.md

1 to write, 0 conflicts, 2 in sync
Wrote 1 file.
```

A copy target that someone wrote by hand is a conflict and is left alone:

```
$ npx onerule sync
conflict  .github/copilot-instructions.md  GitHub Copilot  hand-written, not generated by onerule (--force to overwrite)

0 to write, 1 conflicts, 2 in sync
```

Tool-specific notes go below the import in `CLAUDE.md`. They are kept and `check` still passes:

```
$ cat CLAUDE.md
@AGENTS.md
Use plan mode for changes under src/billing/.
$ npx onerule check
3 targets in sync.
```

### GitHub Actions

```yaml
name: agent instructions
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 22
      - run: npx onerule check
```

### pre-commit

```sh
printf '#!/bin/sh\nnpx onerule check\n' > .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

## Supported tools

| id        | file                                | written as                         | why                                                                                                 |
|-----------|-------------------------------------|------------------------------------|-----------------------------------------------------------------------------------------------------|
| `claude`  | `CLAUDE.md`                         | `@AGENTS.md` import                | Claude Code expands `@path` imports in `CLAUDE.md` ([docs](https://code.claude.com/docs/en/memory))   |
| `gemini`  | `GEMINI.md`                         | `@./AGENTS.md` import              | Gemini CLI expands `@file.md` imports ([docs](https://geminicli.com/docs/reference/memport/))         |
| `copilot` | `.github/copilot-instructions.md`   | generated copy                     | no documented import syntax; several Copilot surfaces don't read `AGENTS.md` ([docs](https://docs.github.com/en/copilot/reference/custom-instructions-support)) |
| `cursor`  | `.cursor/rules/onerule.mdc`         | generated copy, `alwaysApply: true`| `@file` in rules is read on demand, not inlined ([docs](https://cursor.com/docs/context/rules))        |
| `agents`  | `AGENTS.md`                         | generated copy                     | only when the source is another file                                                                |

Codex reads `AGENTS.md` directly. So do Cursor and Copilot's coding agent, which is why `cursor` is off by default when the source is `AGENTS.md`: enabling it would load the same text twice.

## How it works

`onerule.json` names the source and the targets:

```json
{
  "source": "AGENTS.md",
  "targets": ["claude", "gemini", "copilot"]
}
```

Without it, onerule uses `AGENTS.md` and the default targets. Each target is a row in `src/sync.ts`. For each one onerule computes a state:

- **import targets** are `ok` when any line of the file is the import. A missing file is created with just the import. A file without it gets the import prepended and keeps its content, unless that content is already in the source, in which case the file is replaced by the import.
- **copy targets** are `ok` when the file equals what onerule would generate. A stale generated copy is `drifted`. A file without the generated header is a `conflict` and is only replaced with `--force`.

`sync --apply` writes every non-`ok` target except conflicts. `check` exits 1 if any target is not `ok`.

## FAQ

**Doesn't Claude Code read `AGENTS.md` on its own now?**
Recent versions do, but only when there is no `CLAUDE.md` or `CLAUDE.local.md`, and the docs list sessions where it can't. A `CLAUDE.md` with `@AGENTS.md` works on every version and still lets you add Claude-only notes.

**Why not symlinks?**
Symlinks need Developer Mode or admin rights on Windows, and git checks them out as plain text files when `core.symlinks` is off. Import lines work everywhere.

**Will `check` fail because Windows checked files out with CRLF?**
No. Line endings are normalized before comparing.

**Does VS Code Copilot see the instructions twice?**
VS Code chat reads both `AGENTS.md` and `.github/copilot-instructions.md`. If that's your only Copilot surface, drop `copilot` from `targets`.

**Can the source live somewhere else?**
Yes. `"source": "docs/agents.md"` works; imports become `@docs/agents.md` and `AGENTS.md` can be a target.

**What about my other `.cursor/rules/*.mdc` files?**
They're scoped rules and Cursor handles many of them natively. onerule only owns `.cursor/rules/onerule.mdc` and never merges or touches the rest.

**Does it resolve `@` imports inside the source when making copies?**
No. Copies are verbatim.

## Roadmap

- nested `AGENTS.md` files in subdirectories
- `--json` output for `status` and `check`
- more targets where a tool documents its file: Windsurf, Cline, Zed, Junie
- `init` for user-level files (`~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`)

## Contributing

Issues and PRs are welcome. For a new target, link the tool's docs showing which file it reads and whether it supports imports.

```sh
git clone https://github.com/Abdalkaderdev/onerule
cd onerule
npm install
npm test
node src/bin.ts status
```

Tests run in temporary directories. This repo uses onerule on itself: edit `AGENTS.md`, then `node src/bin.ts sync --apply`.

## License

[MIT](LICENSE)

## Author

Abdalkader Alhamoud · [abdalkader.dev](https://abdalkader.dev) · [@Abdalkaderdev](https://github.com/Abdalkaderdev)
