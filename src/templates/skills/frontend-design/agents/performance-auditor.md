# Agent: codi-performance-auditor

> Performance auditor for frontend Core Web Vitals and rendering optimization.

## When to Delegate

- Frontend implementation needs performance validation (LCP, INP, CLS)
- The user asks for performance audit of UI components
- Bundle size, lazy loading, or rendering optimizations need review

## How to Use

Defined at `.codi/agents/codi-performance-auditor.md`. Invoke via the Agent tool with `subagent_type` set to `codi-performance-auditor`.

## Key Capabilities

- Core Web Vitals analysis (LCP < 2.5s, INP < 200ms, CLS < 0.1)
- Bundle size and tree-shaking analysis
- Rendering performance and memory leak detection
