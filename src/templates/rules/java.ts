export const template = `---
name: {{name}}
description: Java conventions — records, streams, Optional, testing, dependency injection
priority: medium
alwaysApply: false
managed_by: codi
language: java
---

# Java Conventions

## Records & Data Types
- Use records for immutable data transfer objects — no manual getters
- Use sealed interfaces with records for algebraic data types
- Never return null — use \`Optional.empty()\` for absent values
- Prefer \`List.of()\`, \`Map.of()\` for immutable collections

\`\`\`java
// BAD: mutable POJO with null returns
public class UserDto {
    private String name;
    public String getName() { return name; }
    public void setName(String n) { this.name = n; }
}

// GOOD: immutable record
public record UserDto(String name, String email) {}
\`\`\`

## Optional Usage
- Return \`Optional<T>\` from methods that may not produce a result
- Never call \`get()\` without \`isPresent()\` — use \`orElseThrow()\` or \`map()\`
- Never use Optional as a field or method parameter — only as return type

\`\`\`java
// BAD: returns null
public User findById(String id) {
    return users.get(id); // might be null
}

// GOOD: returns Optional
public Optional<User> findById(String id) {
    return Optional.ofNullable(users.get(id));
}
\`\`\`

## Pattern Matching
- Use pattern matching in switch for sealed type hierarchies — the compiler enforces exhaustiveness
- Use guarded patterns with \`when\` for conditional matching: \`case String s when s.length() > 10\`
- Prefer pattern matching over instanceof chains — reduces boilerplate and eliminates explicit casts
- Use unnamed variables (\`_\`, Java 22+) for variables you must declare but never read

## Virtual Threads (Java 21+)
- Use virtual threads for I/O-bound workloads — they are cheap (millions possible) and remove the need for reactive frameworks for simple concurrency
- Create with \`Thread.ofVirtual().start()\` or \`Executors.newVirtualThreadPerTaskExecutor()\`
- Never pool virtual threads — they are meant to be created and discarded per task; pooling negates their purpose
- Avoid pinning: do not hold synchronized blocks during I/O — use ReentrantLock instead; synchronized pins the virtual thread to its carrier

## Sequenced Collections (Java 21+)
- Use SequencedCollection methods for first/last access: getFirst(), getLast(), reversed() — replaces fragmented APIs across List, Deque, SortedSet
- Prefer reversed() over manual reverse iteration — returns a reversed view without copying

## Collections & Streams
- Use Streams API for collection transformations — no manual loops for map/filter
- Prefer method references over lambdas when they improve clarity
- Use \`toList()\` (Java 16+) instead of \`Collectors.toList()\` — less boilerplate and returns unmodifiable list
- Avoid side effects inside stream operations — side effects make streams unpredictable with parallel execution

## Dependency Injection
- Use constructor injection — never field injection with \`@Autowired\`; field injection hides dependencies and breaks testability
- Mark injected fields as \`final\` — enforce immutability
- Keep constructors simple — no business logic in constructors
- Use \`@Qualifier\` when multiple beans of the same type exist

## Database & Security
- Use prepared statements for all database queries — prevent SQL injection
- Load secrets from environment variables or a secret manager — never hardcode
- Validate all user input at controller boundaries
- Use parameterized queries in JPA with \`@Query\` or Criteria API

## Testing
- Use JUnit 5 with \`@ParameterizedTest\` for data-driven tests
- Use \`@Nested\` classes to group related test cases
- Mock external dependencies with Mockito — never mock the class under test
- Name tests descriptively: \`shouldReturnEmpty_whenUserNotFound\`

## Build Tooling
- Use Gradle with Kotlin DSL (build.gradle.kts) for new projects — type-safe, better IDE support than Groovy DSL
- Use version catalogs (libs.versions.toml) for centralized dependency version management
- Pin the Gradle wrapper version in gradle-wrapper.properties — ensures reproducible builds

## Native Image (GraalVM)
- Consider GraalVM native image for cloud-native microservices — sub-second startup, reduced memory footprint
- Avoid reflection in hot paths — use compile-time DI (Micronaut, Quarkus) or Spring AOT processing
- Test with native image in CI — runtime behavior can differ from JVM mode
- Spring Boot 3.x includes built-in AOT support — use \`spring-boot:process-aot\` for native compatibility

## Error Handling
- Define custom exception hierarchies for domain errors
- Use \`try-with-resources\` for all closeable resources — guarantees cleanup even when exceptions are thrown
- Log exceptions with structured context — never swallow silently
- Return appropriate HTTP status codes from exception handlers
`;
