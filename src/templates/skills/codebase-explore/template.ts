import { PROJECT_NAME, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Explore and understand the codebase using the code graph. Use when exploring structure, tracing dependencies, finding callers, or navigating unfamiliar code. Also activate before refactoring or when asked how something works.
category: Developer Tools
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
version: 1
---

# {{name}}

## When to Activate

- User wants to understand how parts of the codebase relate to each other
- User needs to trace callers or dependencies before making a change
- User wants an architecture overview or dependency map

## Available Tools

### Query Code Structure (Natural Language)

**[SYSTEM]** Query the code graph with natural language questions about the code:
- "What functions call UserService.create_user?"
- "Show all classes that inherit from BaseModel"
- "What modules import the config module?"
- "What are the dependencies of PaymentProcessor?"

### Get Source Code by Qualified Name

**[SYSTEM]** Retrieve source code using dot-notation:
- \`app.services.UserService.create_user\`
- \`utils.validators.validate_email\`
- \`models.User\`

### Re-index Repository

**[SYSTEM]** Use when the codebase has changed significantly. For incremental updates after small changes, use the graph-sync skill instead.

## Common Exploration Patterns

### Understanding a Feature
1. Query for the main class/function
2. Find all callers (who uses it?)
3. Find all callees (what does it use?)
4. Trace the dependency chain

### Before Refactoring
1. Query: "What functions call [target_function]?"
2. Query: "What modules import [target_module]?"
3. Understand the full impact radius

### Debugging
1. Query: "Show the call chain for [function_name]"
2. Get source code for relevant functions
3. Trace data flow through the system

### Architecture Overview
1. Query: "What are the main modules in this project?"
2. Query: "Show relationships between services"
3. Query: "What external packages does this project depend on?"

## Graph Schema Reference

**Node Types**: Project, Package, Module, Folder, File, Class, Function, Method, ExternalPackage

**Relationships**: CONTAINS_PACKAGE, CONTAINS_FOLDER, CONTAINS_FILE, CONTAINS_MODULE, DEFINES, DEFINES_METHOD, DEPENDS_ON_EXTERNAL, CALLS
`;
