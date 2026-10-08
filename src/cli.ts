import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { apply, CONFIG, init, initPlans, loadConfig, plan, TARGETS, writeInit, type Plan } from "./sync.ts";

const HELP = `onerule - keep CLAUDE.md, AGENTS.md, GEMINI.md, Cursor and Copilot instructions in sync

Usage:
  onerule init [--source <file>] [--targets <ids>] [--apply]
  onerule status
  onerule sync [--apply] [--force]
  onerule check

Targets: ${TARGETS.map((t) => t.id).join(", ")}
Commands that write are dry runs unless --apply.
`;

function lines(plans: Plan[], out: (l: string) => void, all = false) {
  const width = Math.max(...plans.map((p) => p.target.file.length));
  for (const p of plans) {
    if (!all && p.state === "ok") continue;
    out(`${p.state.padEnd(8)}  ${p.target.file.padEnd(width)}  ${p.target.tool.padEnd(14)}  ${p.note}`.trimEnd());
  }
}

export function run(argv: string[], root = process.cwd(), out = console.log): number {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      apply: { type: "boolean" },
      force: { type: "boolean" },
      source: { type: "string" },
      targets: { type: "string" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
  });
  const [cmd] = positionals;

  if (values.version) {
    out(createRequire(import.meta.url)("../package.json").version);
    return 0;
  }

  switch (cmd) {
    case "init": {
      if (existsSync(join(root, CONFIG))) {
        out(`${CONFIG} already exists. Use: npx onerule sync`);
        return 1;
      }
      const result = init(root, values.source, values.targets?.split(",").map((s) => s.trim()));
      const plans = initPlans(root, result);
      const { source } = result.config;
      const merged = result.merged.filter((f) => f !== source);
      out(`${result.created ? "create" : "keep  "}    ${source}${merged.length ? ` (merging ${merged.join(", ")})` : ""}`);
      out(`create    ${CONFIG} (targets: ${result.config.targets.join(", ")})`);
      lines(plans, out);
      if (!values.apply) {
        out("\nDry run. Re-run with --apply to write.");
        return 0;
      }
      writeInit(root, result, plans);
      out(`\nDone. Edit ${source}, then run: npx onerule sync --apply`);
      return 0;
    }

    case "status": {
      const config = loadConfig(root);
      out(`source    ${config.source}${existsSync(join(root, CONFIG)) ? "" : ` (no ${CONFIG}, using defaults)`}`);
      lines(plan(root, config), out, true);
      return 0;
    }

    case "sync": {
      const plans = plan(root);
      lines(plans, out);
      const count = (s: string) => plans.filter((p) => p.state === s).length;
      const writes = plans.length - count("ok") - (values.force ? 0 : count("conflict"));
      out(`\n${writes} to write, ${count("conflict")} conflicts, ${count("ok")} in sync`);
      if (values.apply) {
        apply(root, plans, values.force);
        if (writes) out(`Wrote ${writes} file${writes === 1 ? "" : "s"}.`);
      } else if (writes) out("Dry run. Re-run with --apply to write.");
      return 0;
    }

    case "check": {
      const plans = plan(root);
      const bad = plans.filter((p) => p.state !== "ok");
      lines(bad, out);
      if (bad.length) {
        out(`\n${bad.length} of ${plans.length} targets out of sync. Run: npx onerule sync --apply`);
        return 1;
      }
      out(`${plans.length} targets in sync.`);
      return 0;
    }

    default:
      out(HELP);
      return cmd ? 1 : 0;
  }
}
