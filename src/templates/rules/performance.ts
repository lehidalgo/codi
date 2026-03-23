export const template = `---
name: {{name}}
description: Performance optimization guidelines
priority: medium
alwaysApply: true
managed_by: codi
---

# Performance Guidelines

## Database & Queries
- Avoid N+1 queries — use eager loading or batch fetching
- Add indexes for frequently queried columns
- Use pagination for list endpoints — never return unbounded results
- Select only needed columns, not SELECT *

## Async & Concurrency
- Parallelize independent async operations (Promise.all or equivalent)
- Do not block the main thread with synchronous I/O
- Use connection pooling for database and HTTP clients
- Set appropriate timeouts on all async operations

## Caching
- Cache expensive computations and frequently accessed data
- Define cache invalidation strategy before adding a cache
- Use appropriate TTLs — stale data is worse than no cache
- Cache at the right level: in-memory, CDN, or distributed

## Payload & Transfer
- Minimize payload sizes — send only what the client needs
- Compress responses (gzip/brotli) for text-based formats
- Use streaming for large data transfers
- Implement efficient serialization formats

## General
- Measure before optimizing — profile to find actual bottlenecks
- Lazy load resources that are not immediately needed
- Prefer algorithms with better time complexity for large datasets
- Set performance budgets and monitor regressions`;
