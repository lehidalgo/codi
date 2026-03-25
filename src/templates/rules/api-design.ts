export const template = `---
name: {{name}}
description: API design conventions and best practices
priority: medium
alwaysApply: true
managed_by: codi
---

# API Design

## RESTful Conventions
- Use nouns for resources: /users, /orders (not /getUsers, /createOrder) — URLs name resources, HTTP methods name actions

BAD: \`POST /createUser\`, \`GET /getUsers\`, \`POST /deleteUser/5\`
GOOD: \`POST /users\`, \`GET /users\`, \`DELETE /users/5\`

- Use HTTP methods for actions: GET (read), POST (create), PUT (replace), PATCH (update), DELETE (remove)
- Use plural nouns for collections: /users not /user
- Nest related resources: /users/:id/orders

## Request & Response
- Validate all request bodies at the API boundary — never trust client input
- Return consistent response format: { data, error, meta } — clients should not guess the response shape
- Return consistent error format: { code, message, details }
- Use proper HTTP status codes: 200 (OK), 201 (Created), 204 (No Content), 400 (Bad Request), 404 (Not Found), 500 (Internal Error)

## Versioning & Evolution
- Version APIs from day one: /api/v1/ or Accept header — adding versioning later requires migrating all clients
- Add new fields as optional — do not remove existing fields
- Deprecate endpoints gracefully with sunset headers
- Document breaking changes in changelogs

## Pagination & Filtering
- Paginate all list endpoints with cursor or offset pagination — unbounded results cause timeouts and OOM errors

BAD: \`GET /orders\` returns all 2 million rows
GOOD: \`GET /orders?cursor=abc&limit=50\` with next/previous links in response

- Support filtering: ?status=active&created_after=2024-01-01
- Support sorting: ?sort=created_at&order=desc
- Return pagination metadata: total count, next/previous links

## Security & Limits
- Implement rate limiting on all public endpoints — prevents abuse and protects backend resources
- Return rate limit headers: X-RateLimit-Limit, X-RateLimit-Remaining
- Require authentication for sensitive operations
- Log all API access for audit trails`;
