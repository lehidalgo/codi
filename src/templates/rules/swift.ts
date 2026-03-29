import { PROJECT_NAME } from "../../constants.js";

export const template = `---
name: {{name}}
description: Swift conventions — value types, protocols, concurrency, testing patterns
priority: medium
alwaysApply: false
managed_by: ${PROJECT_NAME}
language: swift
---

# Swift Conventions

## Swift 6 Language Mode
- Enable Swift 6 language mode to enforce data-race safety as compiler errors — not just warnings
- Migrate incrementally — enable \`StrictConcurrency=complete\` per-target before flipping to Swift 6 mode project-wide
- Annotate types that cross isolation boundaries as \`Sendable\` — the compiler rejects non-Sendable transfers between actors
- Use \`@MainActor\` on UI-bound types and \`nonisolated\` to opt specific methods out of actor isolation

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

## Observation Framework (iOS 17+)
- Use \`@Observable\` macro for state management in SwiftUI — replaces \`ObservableObject\` and \`@Published\` with simpler, more granular tracking
- SwiftUI views automatically track which \`@Observable\` properties they read — no need for \`@ObservedObject\` wrappers

## Noncopyable Types
- Use \`~Copyable\` for types representing unique resources (file handles, locks, GPU buffers) — prevents accidental duplication
- Use \`consuming\` and \`borrowing\` parameter modifiers to control ownership transfer

## Macros
- Use Swift macros for compile-time code generation — prefer \`@attached\` macros over runtime reflection
- Use \`#Preview\` for SwiftUI previews, \`@Observable\` for observation, \`@Model\` for SwiftData

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

## SwiftData (iOS 17+)
- Use SwiftData with \`@Model\` macro for persistence in new projects — simpler API than Core Data with SwiftUI integration
- Use \`@Query\` in SwiftUI views for declarative data fetching with automatic UI updates

## Server-Side Swift
- Use Vapor or Hummingbird for HTTP server applications — both support Swift 6 concurrency natively
- Share models and validation logic between client and server when both are Swift

## Dependencies
- Use Swift Package Manager for dependency management
- Pin dependency versions with exact or range specifiers
- Audit transitive dependencies for security vulnerabilities
- Prefer platform frameworks over third-party libraries when equivalent
`;
