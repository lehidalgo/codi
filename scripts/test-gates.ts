import { decideGitCommand, isPhaseApproval } from "#src/runtime/iron-laws-enforcer.js";

const cases = [
  // Approvals
  { prompt: "ok", expected: true, label: "ok lowercase" },
  { prompt: "OK", expected: true, label: "OK uppercase" },
  { prompt: "Ok", expected: true, label: "Ok titlecase" },
  // Reject — wrong casings
  { prompt: "oK", expected: false, label: "oK mixed (rejected)" },
  { prompt: "okay", expected: false, label: "okay (4 chars)" },
  { prompt: "okie", expected: false, label: "okie" },
  { prompt: "okilly", expected: false, label: "okilly" },
  // Reject — negated
  { prompt: "no ok", expected: false, label: "no ok (negated)" },
  { prompt: "don't ok", expected: false, label: "don't ok" },
  // Approve in context
  { prompt: "dale ok", expected: true, label: "dale ok" },
  { prompt: "ok ahora", expected: true, label: "ok ahora" },
  { prompt: "procede. ok", expected: true, label: "procede. ok" },
  // Old long tokens — must NO LONGER pass
  { prompt: "commit ahora", expected: false, label: "commit ahora (old token)" },
  { prompt: "push it", expected: false, label: "push it (old token)" },
];

console.log("=== Iron Law 7 (decideGitCommand) ===");
for (const c of cases) {
  const r = decideGitCommand({ bashCommand: "git commit -m x", recentPrompts: [c.prompt] });
  const ok = r.allowed === c.expected ? "✓" : "✗";
  console.log(`  ${ok} ${c.label} → allowed=${r.allowed} (expected=${c.expected})`);
}

console.log();
console.log("=== Iron Law 4 (isPhaseApproval) ===");
const phaseApprove = ["ok", "OK", "Ok"];
const phaseReject = ["oK", "okay", "looks good", "yeah", "sure"];
for (const p of phaseApprove) {
  console.log(
    `  ${isPhaseApproval(p) ? "✓" : "✗"} ${JSON.stringify(p)} → ${isPhaseApproval(p)} (expected true)`,
  );
}
for (const p of phaseReject) {
  console.log(
    `  ${!isPhaseApproval(p) ? "✓" : "✗"} ${JSON.stringify(p)} → ${isPhaseApproval(p)} (expected false)`,
  );
}
