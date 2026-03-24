export const template = `---
name: {{name}}
description: React-specific conventions — components, hooks, state management, performance
priority: medium
alwaysApply: false
managed_by: codi
language: typescript
---

# React Conventions

## Components
- Use functional components with TypeScript interfaces for props
- One component per file — name the file after the component (PascalCase)
- Keep components under 150 lines — extract sub-components when larger
- Colocate related files: component, styles, tests, types in the same directory

\`\`\`typescript
// Component file: UserCard.tsx
interface UserCardProps {
  name: string;
  email: string;
  onEdit: (id: string) => void;
}

export function UserCard({ name, email, onEdit }: UserCardProps) {
  return (/* ... */);
}
\`\`\`

## Hooks
- Extract reusable logic into custom hooks (use\` prefix)
- Keep hooks focused — one concern per hook
- Use \`useMemo\` for expensive computations that depend on specific values
- Use \`useCallback\` for callbacks passed to memoized children
- Avoid premature memoization — measure first, optimize second

## State Management
- Start with local state (\`useState\`) — lift only when needed
- Use \`useReducer\` for complex state with multiple related fields
- Keep server state separate from UI state (use React Query, SWR, or similar)
- Avoid prop drilling beyond 2 levels — use context or composition

## Performance
- Use \`React.lazy()\` + \`Suspense\` for route-level code splitting
- Avoid creating objects and functions inside render — extract to constants or hooks
- Use \`key\` prop correctly — stable, unique identifiers, never array indices for dynamic lists
- Profile with React DevTools before optimizing

## Patterns to Avoid
- No inline styles — use CSS modules, Tailwind, or styled-components
- No nested ternaries in JSX — extract to early returns or variables
- No \`useEffect\` for derived state — compute during render instead
- No direct DOM manipulation — use refs only when necessary
`;
