import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { beforeEach, test } from "node:test";
import { run } from "./cli.ts";
import { loadConfig, MARK } from "./sync.ts";

let root: string;

function put(file: string, text: string) {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), text);
}

const get = (file: string) => readFileSync(join(root, file), "utf8");

function cli(...argv: string[]) {
  const lines: string[] = [];
  const code = run(argv, root, (l) => lines.push(l));
  return { code, text: lines.join("\n") };
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "onerule-"));
});

test("init in an empty repo creates a starter source, pointers and a copy", () => {
  assert.match(cli("init").text, /Dry run/);
  assert.ok(!existsSync(join(root, "AGENTS.md")));
  assert.equal(cli("init", "--apply").code, 0);
  assert.match(get("AGENTS.md"), /^# Agent instructions/);
  assert.equal(get("CLAUDE.md"), "@AGENTS.md\n");
  assert.equal(get("GEMINI.md"), "@./AGENTS.md\n");
  assert.ok(get(".github/copilot-instructions.md").startsWith(MARK));
  assert.deepEqual(JSON.parse(get("onerule.json")), { source: "AGENTS.md", targets: ["claude", "gemini", "copilot"] });
  assert.equal(cli("check").code, 0);
  assert.equal(cli("init").code, 1);
});

test("init merges distinct existing files into AGENTS.md and replaces them", () => {
  put("CLAUDE.md", "# Rules\r\nUse pnpm.\r\n");
  put("GEMINI.md", "# Rules\nUse pnpm.\n");
  put(".github/copilot-instructions.md", "Prefer small PRs.\n");
  const out = cli("init", "--apply");
  assert.match(out.text, /merging CLAUDE\.md, GEMINI\.md, \.github\/copilot-instructions\.md/);
  assert.equal(get("AGENTS.md"), "# Rules\nUse pnpm.\n\n## From .github/copilot-instructions.md\n\nPrefer small PRs.\n");
  assert.equal(get("CLAUDE.md"), "@AGENTS.md\n");
  assert.equal(get("GEMINI.md"), "@./AGENTS.md\n");
  assert.match(get(".github/copilot-instructions.md"), /Prefer small PRs/);
  assert.equal(cli("check").code, 0);
});

test("init --source picks CLAUDE.md and turns AGENTS.md into a copy", () => {
  put("CLAUDE.md", "Use bun.\n");
  put(".cursor/rules/old.mdc", "---\nalwaysApply: true\n---\nx\n");
  cli("init", "--source", "CLAUDE.md", "--apply");
  assert.deepEqual(loadConfig(root).targets, ["agents", "gemini", "cursor", "copilot"]);
  assert.match(get("AGENTS.md"), /generated from CLAUDE\.md[\s\S]*Use bun\./);
  assert.equal(get("GEMINI.md"), "@./CLAUDE.md\n");
  assert.match(get(".cursor/rules/onerule.mdc"), /^---\ndescription: Project instructions from CLAUDE\.md\nalwaysApply: true\n---\n<!-- onerule/);
  assert.equal(get(".cursor/rules/old.mdc"), "---\nalwaysApply: true\n---\nx\n");
});

test("sync is a dry run, then writes; check catches drift in copies only", () => {
  put("AGENTS.md", "v1\n");
  let out = cli("sync");
  assert.match(out.text, /missing\s+CLAUDE\.md/);
  assert.match(out.text, /Dry run/);
  assert.equal(cli("check").code, 1);
  assert.ok(!existsSync(join(root, "CLAUDE.md")));

  cli("sync", "--apply");
  assert.equal(cli("check").code, 0);

  put("AGENTS.md", "v2\n");
  out = cli("check");
  assert.equal(out.code, 1);
  assert.match(out.text, /drifted\s+\.github\/copilot-instructions\.md/);
  assert.doesNotMatch(out.text, /CLAUDE\.md/);
  cli("sync", "--apply");
  assert.match(get(".github/copilot-instructions.md"), /v2/);
});

test("sync keeps hand-written CLAUDE.md content and skips hand-written copies", () => {
  put("AGENTS.md", "shared\n");
  put("CLAUDE.md", "Use plan mode for billing.\n");
  put(".github/copilot-instructions.md", "mine\n");
  const out = cli("sync", "--apply");
  assert.match(out.text, /conflict\s+\.github\/copilot-instructions\.md/);
  assert.equal(get("CLAUDE.md"), "@AGENTS.md\n\nUse plan mode for billing.\n");
  assert.equal(get(".github/copilot-instructions.md"), "mine\n");
  assert.equal(cli("check").code, 1);
  cli("sync", "--apply", "--force");
  assert.equal(cli("check").code, 0);
});

test("CRLF checkouts of generated files still count as in sync", () => {
  put("AGENTS.md", "a\nb\n");
  cli("sync", "--apply");
  for (const f of ["AGENTS.md", ".github/copilot-instructions.md"]) put(f, get(f).replace(/\n/g, "\r\n"));
  assert.equal(cli("check").code, 0);
});

test("bad config and missing source are errors", () => {
  assert.throws(() => cli("check"), /source AGENTS\.md not found/);
  put("onerule.json", '{"targets":["nope"]}');
  assert.throws(() => cli("status"), /unknown target "nope"/);
  put("onerule.json", '{"source":"CLAUDE.md","targets":["claude"]}');
  assert.throws(() => cli("status"), /is the source file/);
});
