export const template = `---
name: {{name}}
description: Go conventions — error handling, interfaces, testing, concurrency patterns
priority: medium
alwaysApply: false
managed_by: codi
language: golang
---

# Go Conventions

## Formatting & Tooling
- Run \`gofmt\` and \`goimports\` on every save — non-negotiable
- Run \`gosec\` for static security analysis in CI
- Run \`go vet\` and \`staticcheck\` as part of the linting pipeline
- Use \`golangci-lint\` to aggregate all linters in one pass

## Interfaces
- Accept interfaces, return structs — keep contracts flexible
- Keep interfaces small: 1-3 methods maximum
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

## Concurrency
- Pass \`context.Context\` as the first parameter to all external calls
- Set timeouts on every context used for network or database operations
- Use channels for communication, mutexes for state protection
- Never start goroutines without a plan to stop them

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

## Configuration
- Use the functional options pattern for configurable constructors
- Provide sensible defaults — require only what cannot be defaulted
- Load secrets from environment variables — never embed in source

## Project Structure
- Keep \`main.go\` minimal — delegate to internal packages
- Use \`internal/\` to prevent external imports of private packages
- Group by domain, not by layer (avoid generic \`models/\`, \`utils/\` packages)
- Prefer returning concrete types from constructors for discoverability
`;
