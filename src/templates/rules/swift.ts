export const template = `---
name: {{name}}
description: Swift conventions — value types, protocols, concurrency, testing patterns
priority: medium
alwaysApply: false
managed_by: codi
language: swift
---

# Swift Conventions

## Formatting & Tooling
- Run SwiftFormat and SwiftLint on every build — enforce consistent style
- Fix all linter warnings before merging — treat warnings as errors in CI
- Follow Swift API Design Guidelines for naming conventions
- Use \`swiftformat --lint\` in pre-commit hooks

## Value Types & Immutability
- Prefer \`let\` over \`var\` — use \`var\` only when the compiler requires mutation
- Use structs by default — use classes only for reference semantics or inheritance; structs are copied, eliminating shared mutation bugs
- Use enums with associated values for modeling finite state
- Prefer value semantics to avoid unintended shared mutation

## Protocols
- Design small, focused protocols — one capability per protocol
- Use protocol extensions for default implementations
- Prefer composition of protocols over deep class hierarchies
- Use \`some Protocol\` (opaque types) for return types to hide implementation

\`\`\`swift
protocol Cacheable {
    var cacheKey: String { get }
    var ttl: TimeInterval { get }
}

extension Cacheable {
    var ttl: TimeInterval { 300 } // 5 minutes default
}

struct UserProfile: Cacheable {
    let id: String
    let name: String
    var cacheKey: String { "user-\\(id)" }
}
\`\`\`

## Concurrency
- Use structured concurrency with \`async\`/\`await\` — no completion handlers; async/await prevents callback hell and race conditions
- Mark shared mutable state types as \`Sendable\` — enable strict concurrency checking at compile time
- Use actors for shared mutable state protection — actors serialize access, eliminating data races
- Use \`Task.detached\` sparingly — prefer structured task groups

\`\`\`swift
actor CounterStore {
    private var counts: [String: Int] = [:]

    func increment(_ key: String) -> Int {
        let newValue = (counts[key] ?? 0) + 1
        counts[key] = newValue
        return newValue
    }

    func value(for key: String) -> Int {
        counts[key] ?? 0
    }
}
\`\`\`

## Error Handling
- Use typed throws (Swift 6+) for domain-specific error types
- Define error enums conforming to \`Error\` with descriptive cases
- Use \`Result\` type for synchronous operations that can fail
- Handle errors at the appropriate level — do not over-catch

## Testing
- Use Swift Testing framework with \`@Test\` and \`#expect\`
- Group related tests with \`@Suite\` for organization
- Use parameterized tests with \`@Test(arguments:)\` for multiple inputs
- Mock dependencies using protocol conformances — not subclassing

## Security & Secrets
- Store secrets in Keychain Services — never in UserDefaults or plists; UserDefaults is stored as plaintext XML
- Use App Transport Security — enforce HTTPS for all connections
- Validate all external input before processing
- Use \`Data\` instead of \`String\` for sensitive values to control memory lifetime

## Dependencies
- Use Swift Package Manager for dependency management
- Pin dependency versions with exact or range specifiers
- Audit transitive dependencies for security vulnerabilities
- Prefer platform frameworks over third-party libraries when equivalent
`;
