#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const packPath = path.join(root, "omnirank-prompts.json");
const progressPath = path.join(root, "prompt-progress.json");

const load = p => JSON.parse(fs.readFileSync(p, "utf8"));
const save = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2) + "\n");

const pack = load(packPath);
const progress = load(progressPath);
const byCode = c => pack.prompts.find(p => p.code === c);
const state = c => progress.prompts.find(p => p.code === c);
const depsDone = p => (p.dependsOn || []).every(c => state(c)?.status === "completed");
const now = () => new Date().toISOString();

function printPrompt(p) {
  if (!p) return console.log("NO_PENDING_PROMPT");
  console.log(`CODE: ${p.code}`);
  console.log(`TITLE: ${p.title}`);
  console.log(`DEPENDS_ON: ${(p.dependsOn || []).join(", ") || "none"}`);
  console.log("PROMPT:");
  console.log(p.prompt);
}

function main() {
  const [cmd, code, ...rest] = process.argv.slice(2);
  const note = rest.join(" ").trim();

  if (cmd === "next") {
    const blocked = progress.prompts.find(p => p.status === "blocked");
    if (blocked && pack.stopOnFailure) {
      console.error(`STOPPED: ${blocked.code} is blocked.`);
      process.exit(2);
    }
    const running = progress.prompts.find(p => p.status === "in_progress");
    if (running) return printPrompt(byCode(running.code));
    const next = [...pack.prompts].sort((a,b)=>a.order-b.order)
      .find(p => state(p.code)?.status === "pending" && depsDone(p));
    return printPrompt(next);
  }

  if (cmd === "show") return printPrompt(byCode(code));

  if (cmd === "start") {
    const p = byCode(code), s = state(code);
    if (!p || !s) throw new Error(`Unknown code ${code}`);
    if (!depsDone(p)) throw new Error(`Dependencies incomplete for ${code}`);
    if (!["pending","blocked"].includes(s.status)) throw new Error(`${code} cannot start from ${s.status}`);
    s.status = "in_progress"; s.startedAt ||= now(); s.completedAt = null; s.notes = note || s.notes;
    progress.currentCode = code; save(progressPath, progress);
    return console.log(`STARTED ${code}`);
  }

  if (cmd === "complete") {
    const s = state(code);
    if (!s) throw new Error(`Unknown code ${code}`);
    if (s.status !== "in_progress") throw new Error(`${code} must be in_progress`);
    s.status = "completed"; s.completedAt = now(); s.notes = note || s.notes;
    progress.currentCode = null; save(progressPath, progress);
    return console.log(`COMPLETED ${code}`);
  }

  if (cmd === "block") {
    const s = state(code);
    if (!s) throw new Error(`Unknown code ${code}`);
    s.status = "blocked"; s.notes = note || "Blocked";
    progress.currentCode = code; save(progressPath, progress);
    return console.log(`BLOCKED ${code}: ${s.notes}`);
  }

  if (cmd === "reset") {
    const s = state(code);
    if (!s) throw new Error(`Unknown code ${code}`);
    Object.assign(s, {status:"pending",startedAt:null,completedAt:null,notes:""});
    progress.currentCode = null; save(progressPath, progress);
    return console.log(`RESET ${code}`);
  }

  if (cmd === "status") {
    for (const p of [...pack.prompts].sort((a,b)=>a.order-b.order)) {
      console.log(`${p.code}\t${state(p.code)?.status}\t${p.title}`);
    }
    return;
  }

  console.log(`Usage:
node scripts/prompt-sequencer.mjs next
node scripts/prompt-sequencer.mjs show OR-P01
node scripts/prompt-sequencer.mjs start OR-P01
node scripts/prompt-sequencer.mjs complete OR-P01 "note"
node scripts/prompt-sequencer.mjs block OR-P01 "reason"
node scripts/prompt-sequencer.mjs reset OR-P01
node scripts/prompt-sequencer.mjs status`);
}

main();
