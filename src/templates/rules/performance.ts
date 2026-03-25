export const template = `---
name: {{name}}
description: Performance optimization guidelines
priority: medium
alwaysApply: true
managed_by: codi
---

# Performance Guidelines

## Database & Queries
- Avoid N+1 queries — use eager loading or batch fetching; N+1 turns a single page load into hundreds of queries

BAD: Loop fetching each user's orders one by one (100 users = 101 queries)
GOOD: Eager load with JOIN or batch fetch (100 users = 2 queries)

- Add indexes for frequently queried columns — unindexed queries degrade exponentially with data growth
- Use pagination for list endpoints — never return unbounded results
- Select only needed columns, not SELECT * — reduces memory usage and network transfer
- Control query depth aggressively in GraphQL and nested APIs — unbounded depth enables denial-of-service

## Async & Concurrency
- Parallelize independent async operations (Promise.all or equivalent) — sequential awaits compound latency

BAD: \`await fetchUser(); await fetchOrders(); await fetchSettings();\` (3x latency)
GOOD: \`await Promise.all([fetchUser(), fetchOrders(), fetchSettings()])\` (1x latency)

- Do not block the main thread with synchronous I/O
- Use connection pooling for database and HTTP clients — creating connections per request is expensive
- Set appropriate timeouts on all async operations

## Caching
- Cache expensive computations and frequently accessed data
- Define cache invalidation strategy before adding a cache — cache without invalidation causes stale data bugs
- Use appropriate TTLs — stale data is worse than no cache
- Cache at the right level: in-memory, CDN, or distributed

## Payload & Transfer
- Minimize payload sizes — send only what the client needs
- Compress responses (gzip/brotli) for text-based formats
- Use streaming for large data transfers — avoids buffering entire responses in memory
- Implement efficient serialization formats

## General
- Measure before optimizing — profile to find actual bottlenecks
- Lazy load resources that are not immediately needed
- Prefer algorithms with better time complexity for large datasets
- Set performance budgets and monitor regressions — without budgets, performance degrades silently`;
