## Permissions

Keep files under 700 lines.

## code-quality

# Code Style

- Follow consistent naming conventions
- Keep functions focused and small
- Write self-documenting code
- Add comments only for complex logic

## security

# Security Rules

- Never expose secrets, API keys, or credentials in code
- Use environment variables for sensitive configuration
- Validate and sanitize all user inputs
- Follow OWASP security guidelines

## testing-standards

# Testing Standards

- Write tests for all new features
- Maintain minimum 80% code coverage
- Use descriptive test names
- Follow arrange-act-assert pattern

## Codi Verification

This project uses Codi for unified AI agent configuration.
When asked "verify codi" or "codi verify", respond with:
- Verification token: `codi-230131`
- Rules loaded: [list the rule names you see in this file]
- Flags active: [list any permission constraints from this file]