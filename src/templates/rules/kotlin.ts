export const template = `---
name: {{name}}
description: Kotlin conventions — null safety, sealed classes, coroutines, testing patterns
priority: medium
alwaysApply: false
managed_by: codi
language: kotlin
---

# Kotlin Conventions

## Formatting & Tooling
- Run ktfmt or ktlint on every save — enforce consistent formatting
- Use trailing commas in parameter lists, collection literals, and enums
- Follow Kotlin official coding conventions for naming and structure
- Configure detekt for static analysis in CI

## Null Safety
- Avoid the \`!!\` operator — use safe alternatives instead
- Use \`?.\` for safe calls, \`?:\` (Elvis) for defaults, \`let\` for scoped operations
- Prefer non-nullable types in public APIs — push nullability to boundaries; callers should not deal with null unless unavoidable
- Use \`requireNotNull()\` with a message when null is a programming error

\`\`\`kotlin
// BAD: force-unwrap crashes at runtime
val length = name!!.length

// GOOD: safe call with default
val length = name?.length ?: 0

// GOOD: scoped null check with let
name?.let { validName ->
    repository.save(validName)
}
\`\`\`

## Immutability
- Prefer \`val\` over \`var\` — use \`var\` only when mutation is required
- Use immutable collections (\`listOf\`, \`mapOf\`) by default — prevents unintended modification by other code
- Use \`data class\` for value objects — get equals, hashCode, copy for free
- Use \`copy()\` to create modified instances instead of mutating

## Sealed Classes
- Use sealed classes for exhaustive type hierarchies
- Combine with \`when\` expressions — the compiler enforces all cases
- Prefer sealed interfaces when no shared state is needed

\`\`\`kotlin
sealed class Result<out T> {
    data class Success<T>(val data: T) : Result<T>()
    data class Failure(val error: Throwable) : Result<Nothing>()
}

fun <T> Result<T>.getOrThrow(): T = when (this) {
    is Result.Success -> data
    is Result.Failure -> throw error
}
\`\`\`

## Scope Functions
- Use \`apply\` for object configuration, \`also\` for side effects
- Use \`let\` for null-safe transformations, \`run\` for scoped computation
- Avoid nesting scope functions — extract to named functions instead; nested scopes obscure what \`this\` and \`it\` refer to

## Coroutines
- Use structured concurrency — launch coroutines in a defined scope; unscoped coroutines leak and cannot be cancelled
- Use \`withContext(Dispatchers.IO)\` for blocking operations — prevents blocking the main/default dispatcher
- Test coroutines with \`runTest\` from kotlinx-coroutines-test
- Set timeouts with \`withTimeout()\` on all external calls

## Testing
- Use Kotest with spec styles (BehaviorSpec, StringSpec) for expressive tests
- Use MockK for mocking — \`every\`, \`coEvery\` for coroutines
- Name tests as behaviors: \`"should return empty list when no users found"\`
- Use \`@ParameterizedTest\` or Kotest data-driven testing for multiple inputs

## Database & Security
- Use Exposed DSL or JOOQ for type-safe parameterized queries — never raw SQL
- Load secrets from environment variables or vault — never hardcode
- Validate input at API boundaries with Ktor or Spring validation
`;
