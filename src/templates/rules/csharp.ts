import { PROJECT_NAME } from "#src/constants.js";

export const template = `---
name: {{name}}
description: C# conventions — records, async patterns, LINQ, nullable types, testing
priority: medium
alwaysApply: false
managed_by: ${PROJECT_NAME}
language: csharp
---

# C# Conventions

## Records & Data Types
- Use records for immutable data models — get equality, hashing, and deconstruction
- Use \`init\` properties for immutable object construction
- Enable nullable reference types (\`<Nullable>enable</Nullable>\`) project-wide — catches null reference bugs at compile time
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
- Use \`async\`/\`await\` for all I/O operations — never block with \`.Result\` or \`.Wait()\`; blocking causes thread pool starvation and deadlocks
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
- Use \`IReadOnlyList<T>\` and \`IReadOnlyDictionary<K,V>\` in public APIs — prevents callers from mutating your internal state
- Avoid materializing queries prematurely — defer \`.ToList()\` until needed; premature materialization wastes memory on unused results

## Nullable Reference Types
- Annotate all public APIs with nullability — no ambiguous references
- Use \`!\` (null-forgiving) only when you can prove the value is non-null
- Use pattern matching for null checks: \`if (value is { } valid)\`
- Return empty collections instead of null for collection-typed returns

## Primary Constructors (C# 12+)
- Use primary constructors on service classes to reduce DI boilerplate — parameters are available throughout the class body
- Capture primary constructor parameters in readonly fields when mutation must be prevented — primary constructor parameters are mutable by default

## Collection Expressions (C# 12+)
- Use collection expressions (\`[1, 2, 3]\`) for initializing arrays, lists, spans, and immutable collections — unified syntax
- Use the spread operator (\`..\`) to combine collections: \`[..existing, newItem]\`

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

## Native AOT
- Use Native AOT for microservices and serverless functions — reduces startup time and eliminates JIT overhead
- Avoid reflection-heavy patterns in AOT targets — use source generators instead
- Use \`[JsonSerializable]\` source generator for System.Text.Json in AOT contexts — reflection-based serialization does not work

## Source Generators
- Use source generators instead of runtime reflection for serialization, logging, and DI — required for AOT compatibility
- Use \`[LoggerMessage]\` source generator for high-performance structured logging — avoids boxing and string interpolation overhead

## High-Performance Patterns
- Use \`Span<T>\` and \`ReadOnlySpan<T>\` for slicing data without heap allocations — significantly faster for string processing
- Use \`Memory<T>\` when the buffer must be stored on the heap or passed across async boundaries — \`Span<T>\` is stack-only
- Prefer \`ArrayPool<T>.Shared\` for reusable buffers in hot paths — reduces allocation churn

## Observability
- Use OpenTelemetry for distributed tracing, metrics, and structured logging — CNCF standard with first-class .NET support
- Configure \`ActivitySource\` for custom trace spans and \`Meter\` for custom metrics
- Use .NET Aspire for cloud-native distributed applications — provides service discovery, health checks, and telemetry out of the box

## Error Handling
- Use \`ILogger<T>\` with structured logging — include correlation IDs
- Define custom exception types for domain-specific errors
- Use global exception handling middleware — no scattered try/catch; centralized handling ensures consistent error responses
- Return \`ProblemDetails\` responses for API errors (RFC 9457)
`;
