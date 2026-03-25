export const template = `---
name: {{name}}
description: TypeScript-specific conventions — strict typing, immutability, async patterns
priority: medium
alwaysApply: false
managed_by: codi
language: typescript
---

# TypeScript Conventions

## Strict Typing
- Never use \`any\` — use \`unknown\` and narrow with type guards
- Enable \`strict: true\` in tsconfig.json — catches entire categories of bugs at compile time
- Use discriminated unions over type assertions — type assertions bypass the compiler and hide bugs
- Prefer \`interface\` for object shapes, \`type\` for unions and intersections

\`\`\`typescript
// BAD: any loses all type safety
function parse(data: any) { return data.name; }

// GOOD: unknown forces safe narrowing
function parse(data: unknown): string {
  if (typeof data === 'object' && data !== null && 'name' in data) {
    return String(data.name);
  }
  throw new Error('Invalid data');
}
\`\`\`

## Exports & Imports
- Use named exports — no default exports (improves refactoring and auto-imports)
- Group imports: external libraries, internal modules, types — makes dependency sources immediately visible
- Use \`import type\` for type-only imports — keeps runtime bundle clean

## Immutability
- Prefer \`const\` over \`let\` — never use \`var\`
- Use \`readonly\` on properties that should not change after construction
- Create new objects instead of mutating: spread, map, filter
- Use \`as const\` for literal types

\`\`\`typescript
// BAD: mutation
items.push(newItem);

// GOOD: new array
const updated = [...items, newItem];
\`\`\`

## Async Patterns
- Use \`Promise.all()\` for independent async operations — avoid sequential await
- Always handle promise rejections — use try/catch or .catch()
- Prefer async/await over .then() chains for readability
- Set timeouts on all external calls

## Validation
- Validate external input at system boundaries with Zod or similar — compile-time types vanish at runtime
- Trust internal types — no redundant runtime checks inside the module
- Use branded types for domain identifiers (UserId, OrderId) — prevents accidentally passing an OrderId where a UserId is expected

## Enums & Constants
- Prefer \`as const\` objects over TypeScript enums — better tree-shaking and no runtime overhead
- Use string literal unions for simple choices: \`type Status = 'active' | 'inactive'\`
`;
