# codi-claude-artifacts-builder

Builds complex multi-component claude.ai HTML artifacts using React 18, TypeScript, Vite, Tailwind CSS, and shadcn/ui. Bundles everything into a single self-contained HTML file for use as a claude.ai artifact.

## Prerequisites

| Dependency | Install | Purpose |
|------------|---------|---------|
| Node.js 18+ | required | Vite dev server and build |
| pnpm / npm | required | package manager |
| bash | required | initialization and bundle scripts |

## Scripts

| File | Purpose |
|------|---------|
| `scripts/init-artifact.sh` | Scaffold a new React + Tailwind + shadcn/ui project |
| `scripts/bundle-artifact.sh` | Build and bundle the project to a single HTML file |
| `scripts/shadcn-components.tar.gz` | Pre-built shadcn/ui component bundle (unpacked by init script) |

## Quick Start

```bash
# 1. Initialize the project
bash scripts/init-artifact.sh my-artifact
cd my-artifact

# 2. Develop — edit src/ files normally
# The init script sets up:
# - React 18 + TypeScript via Vite
# - Tailwind CSS 3.4.1 with shadcn/ui theming
# - 40+ shadcn/ui components pre-installed
# - Radix UI dependencies
# - Path alias @/ configured
# - Parcel bundler configured for single-HTML output

# 3. Bundle to a single HTML file
bash ../scripts/bundle-artifact.sh

# 4. The output file is ready to paste into claude.ai as an artifact
```

## Stack

| Tool | Version | Role |
|------|---------|------|
| React | 18 | UI framework |
| TypeScript | 5+ | type safety |
| Vite | auto-detected | dev server |
| Tailwind CSS | 3.4.1 | utility styles |
| shadcn/ui | latest | component library |
| Parcel | latest | single-HTML bundler |

## Design Notes

Avoid "AI slop" patterns: excessive centered layouts, purple gradients, uniform rounded corners, and Inter font. Use varied layouts and typography to produce distinctive interfaces.
