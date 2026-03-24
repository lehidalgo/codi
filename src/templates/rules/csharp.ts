export const template = `---
name: {{name}}
description: C# conventions — records, async patterns, LINQ, nullable types, testing
priority: medium
alwaysApply: false
managed_by: codi
language: csharp
---

# C# Conventions

## Records & Data Types
- Use records for immutable data models — get equality, hashing, and deconstruction
- Use \`init\` properties for immutable object construction
- Enable nullable reference types (\`<Nullable>enable</Nullable>\`) project-wide
- Prefer \`record struct\` for small value types to avoid heap allocations

\`\`\`csharp
// BAD: mutable class with manual equality
public class UserDto {
    public string Name { get; set; }
    public string Email { get; set; }
}

// GOOD: immutable record with structural equality
public record UserDto(string Name, string Email);

// GOOD: record with validation
public record OrderId {
    public string Value { get; }
    public OrderId(string value) {
        ArgumentException.ThrowIfNullOrWhiteSpace(value);
        Value = value;
    }
}
\`\`\`

## Async Patterns
- Use \`async\`/\`await\` for all I/O operations — never block with \`.Result\` or \`.Wait()\`
- Use \`ConfigureAwait(false)\` in library code to avoid deadlocks
- Use \`IAsyncDisposable\` with \`await using\` for async resource cleanup
- Prefer \`ValueTask<T>\` over \`Task<T>\` for hot paths that often complete synchronously

\`\`\`csharp
// GOOD: async disposal pattern
await using var connection = await CreateConnectionAsync();
await using var transaction = await connection.BeginTransactionAsync();

try {
    await ExecuteCommandsAsync(transaction);
    await transaction.CommitAsync();
} catch {
    await transaction.RollbackAsync();
    throw;
}
\`\`\`

## LINQ & Collections
- Use LINQ for collection transformations — no manual loops for map/filter/reduce
- Prefer method syntax for complex queries, query syntax for joins
- Use \`IReadOnlyList<T>\` and \`IReadOnlyDictionary<K,V>\` in public APIs
- Avoid materializing queries prematurely — defer \`.ToList()\` until needed

## Nullable Reference Types
- Annotate all public APIs with nullability — no ambiguous references
- Use \`!\` (null-forgiving) only when you can prove the value is non-null
- Use pattern matching for null checks: \`if (value is { } valid)\`
- Return empty collections instead of null for collection-typed returns

## Dependency Injection
- Register services in \`Program.cs\` — use the built-in DI container
- Use constructor injection — never resolve from the container manually
- Register scoped services for per-request lifetimes
- Use \`IOptions<T>\` for typed configuration binding

## Testing
- Use xUnit with \`[Theory]\` and \`[InlineData]\` for parameterized tests
- Use \`[Fact]\` for single-case tests, \`[Theory]\` for data-driven tests
- Mock dependencies with NSubstitute or Moq — never mock the class under test
- Name tests: \`MethodName_Condition_ExpectedResult\`

## Database & Security
- Use Entity Framework with LINQ queries — avoid raw SQL
- Load secrets via \`IConfiguration\` and the Secret Manager in development
- Use Azure Key Vault or equivalent in production — never hardcode secrets
- Validate input with data annotations or FluentValidation at API boundaries

## Error Handling
- Use \`ILogger<T>\` with structured logging — include correlation IDs
- Define custom exception types for domain-specific errors
- Use global exception handling middleware — no scattered try/catch
- Return \`ProblemDetails\` responses for API errors (RFC 9457)
`;
