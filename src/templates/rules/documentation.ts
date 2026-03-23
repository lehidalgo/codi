export const template = `---
name: {{name}}
description: Documentation standards and practices
priority: medium
alwaysApply: true
managed_by: codi
---

# Documentation Standards

## Code Documentation
- Write self-documenting code first — clear names, small functions
- Add JSDoc/docstrings to all public APIs: purpose, parameters, return value, examples
- Document non-obvious behavior with inline comments (WHY, not WHAT)
- Keep documentation close to the code it describes

## Project Documentation
- Keep README up to date with every significant change
- Include: what the project does, how to install, how to use, how to contribute
- Document environment setup and prerequisites
- Provide working examples that can be copy-pasted

## Architecture Documentation
- Document high-level architecture decisions and their rationale
- Use Architecture Decision Records (ADRs) for significant choices
- Include diagrams for complex system interactions
- Keep architecture docs updated when the system evolves

## API Documentation
- Document all endpoints: method, path, parameters, request/response bodies
- Include example requests and responses
- Document error responses and status codes
- Version the documentation alongside the API

## Maintenance
- Remove outdated documentation — wrong docs are worse than no docs
- Review documentation during code review
- Use automated tools to detect broken links and examples
- Write documentation as part of the feature, not after`;
