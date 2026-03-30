import { PROJECT_NAME } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Go conventions — error handling, interfaces, testing, concurrency patterns
priority: medium
alwaysApply: false
managed_by: ${PROJECT_NAME}
language: golang
---

# Go Conventions

## Formatting & Tooling
- Run \`gofmt\` and \`goimports\` on every save — non-negotiable; eliminates all formatting debates
- Run \`gosec\` for static security analysis in CI
- Run \`go vet\` and \`staticcheck\` as part of the linting pipeline
- Use \`golangci-lint\` to aggregate all linters in one pass

## Structured Logging
- Use log/slog for all new code (Go 1.21+) — structured key-value logging in the standard library
- Use slog.With() to attach context (request ID, user ID) — avoids repeating fields in every log call
- Choose JSONHandler for production, TextHandler for development

## Interfaces
- Accept interfaces, return structs — keep contracts flexible for callers, concrete for implementers
- Keep interfaces small: 1-3 methods maximum — large interfaces are harder to implement and mock
- Define interfaces where they are consumed, not where they are implemented
- Use the standard naming convention: single-method interfaces end in \`-er\`

## Error Handling
- Never ignore errors — handle or propagate every one
- Wrap errors with context using \`fmt.Errorf\` and the \`%w\` verb
- Check errors immediately after the call — no deferred checking
- Use sentinel errors or custom types for errors callers must inspect

\`\`\`go
// BAD: error ignored
data, _ := os.ReadFile(path)

// GOOD: error wrapped with context
data, err := os.ReadFile(path)
if err != nil {
    return fmt.Errorf("read config %s: %w", path, err)
}
\`\`\`

## Generics
- Use generics for type-safe data structures and utility functions — avoid interface{}/any when the type is known at call sites
- Prefer concrete types when only one or two types are needed — generics add complexity
- Use type constraints from the constraints package or define your own with interface unions
- Avoid over-generalizing — write the concrete version first, generalize only when a second type appears

## Concurrency
- Pass \`context.Context\` as the first parameter to all external calls — enables cancellation and deadline propagation
- Set timeouts on every context used for network or database operations
- Use channels for communication, mutexes for state protection
- Never start goroutines without a plan to stop them — leaked goroutines cause memory leaks and deadlocks

## Testing
- Write table-driven tests for functions with multiple input scenarios
- Run tests with \`-race\` flag in CI to detect data races
- Use \`t.Helper()\` in test helper functions for accurate line reporting
- Use \`testify/assert\` or standard library — keep test dependencies minimal

\`\`\`go
func TestParsePort(t *testing.T) {
    tests := []struct {
        name    string
        input   string
        want    int
        wantErr bool
    }{
        {"valid port", "8080", 8080, false},
        {"empty string", "", 0, true},
        {"out of range", "99999", 0, true},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got, err := ParsePort(tt.input)
            if (err != nil) != tt.wantErr {
                t.Fatalf("error = %v, wantErr %v", err, tt.wantErr)
            }
            if got != tt.want {
                t.Errorf("got %d, want %d", got, tt.want)
            }
        })
    }
}
\`\`\`

## HTTP Routing (Go 1.22+)
- Use the standard net/http.ServeMux — Go 1.22+ supports method matching and path wildcards natively
- Pattern format: "METHOD /path/{param}" — e.g., \`mux.HandleFunc("GET /tasks/{id}", handler)\`
- Evaluate third-party routers only when you need middleware chaining or OpenAPI integration not covered by ServeMux

## Iterators (Go 1.23+)
- Use range-over-function iterators for custom sequences — implement func(yield func(K, V) bool)
- Use slices.All, slices.Values, slices.Backward for standard iteration patterns over slices
- Use maps.Keys, maps.Values for map iteration
- Use \`for i := range n\` to iterate from 0 to n-1 — cleaner than C-style for loops

## Configuration
- Use the functional options pattern for configurable constructors
- Provide sensible defaults — require only what cannot be defaulted
- Load secrets from environment variables — never embed in source

## Project Structure
- Keep \`main.go\` minimal — delegate to internal packages
- Use \`internal/\` to prevent external imports of private packages — the Go compiler enforces this boundary
- Group by domain, not by layer (avoid generic \`models/\`, \`utils/\` packages)
- Prefer returning concrete types from constructors for discoverability
`;
