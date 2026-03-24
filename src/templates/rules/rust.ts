export const template = `---
name: {{name}}
description: Rust conventions — ownership, error handling, traits, testing patterns
priority: medium
alwaysApply: false
managed_by: codi
language: rust
---

# Rust Conventions

## Ownership & Borrowing
- Prefer borrowing (\`&T\`, \`&mut T\`) over cloning — clone only when necessary
- Use \`String\` for owned data, \`&str\` for borrowed string slices
- Move values into functions when the caller no longer needs them
- Use \`Cow<str>\` when a function may or may not need to allocate

## Error Handling
- Return \`Result<T, E>\` for all fallible operations — no panics in library code
- Use the \`?\` operator to propagate errors concisely
- Use \`thiserror\` for custom error types in libraries
- Use \`anyhow\` for application-level error handling with context

\`\`\`rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ConfigError {
    #[error("file not found: {path}")]
    NotFound { path: String },
    #[error("parse error at line {line}: {message}")]
    Parse { line: usize, message: String },
    #[error(transparent)]
    Io(#[from] std::io::Error),
}

fn load_config(path: &str) -> Result<Config, ConfigError> {
    let content = std::fs::read_to_string(path)?;
    parse_config(&content)
}
\`\`\`

## Traits & Abstractions
- Use traits for abstraction — define behavior, not data
- Keep trait definitions small and focused — one concern per trait
- Implement standard traits: \`Debug\`, \`Clone\`, \`Display\` where appropriate
- Use derive macros for boilerplate: \`#[derive(Debug, Clone, Serialize)]\`

## Lifetimes
- Let the compiler infer lifetimes when possible — annotate only when required
- Name lifetimes descriptively for complex signatures: \`'input\`, \`'conn\`
- Prefer owned types in public APIs to avoid lifetime complexity for callers
- Use \`'static\` only for truly static data — not as a workaround

## Linting & Formatting
- Run \`cargo fmt\` on every save — non-negotiable
- Run \`clippy\` and fix all warnings — treat them as errors in CI
- Use \`#[must_use]\` on functions whose return values must not be ignored
- Enable \`#![deny(clippy::all)]\` in library crates

## Testing
- Place unit tests in \`#[cfg(test)]\` modules within the same file
- Use integration tests in the \`tests/\` directory for public API testing
- Name tests as behaviors: \`test_parse_returns_error_for_empty_input\`
- Use \`assert_eq!\` with descriptive messages for clear failure output

\`\`\`rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_returns_error_for_empty_input() {
        let result = parse_config("");
        assert!(result.is_err(), "empty input should produce an error");
    }

    #[test]
    fn parse_extracts_port_from_valid_config() {
        let config = parse_config("port = 8080").unwrap();
        assert_eq!(config.port, 8080);
    }
}
\`\`\`

## Performance & Safety
- Prefer iterators over manual index loops — they optimize better
- Use \`Vec::with_capacity\` when the size is known ahead of time
- Avoid \`unsafe\` unless absolutely necessary — document every usage
- Use \`Arc<T>\` for shared ownership across threads, \`Rc<T>\` for single-threaded
`;
