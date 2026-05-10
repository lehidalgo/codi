import { decideGitCommand } from "#src/runtime/iron-laws-enforcer.js";
const cases = [
  { prompts: ["ok"], cmd: "git commit -m 'x'" },
  { prompts: ["OK"], cmd: "git commit -m 'x'" },
  { prompts: ["Ok"], cmd: "git commit -m 'x'" },
  { prompts: ["okay"], cmd: "git commit -m 'x'" }, // not 2-char ok
  { prompts: ["commit ahora"], cmd: "git commit -m 'x'" }, // old long token, should NO LONGER match
  { prompts: ["antes d ecommit"], cmd: "git commit -m 'x'" }, // user's typo, should fail
  { prompts: ["no ok"], cmd: "git commit -m 'x'" }, // negated
  { prompts: ["ok ahora"], cmd: "git commit -m 'x'" }, // pass
  { prompts: ["dale ok"], cmd: "git commit -m 'x'" }, // pass
];
for (const c of cases) {
  const r = decideGitCommand({ bashCommand: c.cmd, recentPrompts: c.prompts });
  console.log(
    `  ${r.allowed ? "✓" : "✗"} prompt=${JSON.stringify(c.prompts[0])} → ${r.reason.slice(0, 60)}`,
  );
}
