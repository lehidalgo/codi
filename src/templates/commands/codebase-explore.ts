import { PROJECT_NAME } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Explore and understand the codebase using the code graph knowledge graph
managed_by: ${PROJECT_NAME}
---

Explore and understand the codebase using the graph-code MCP knowledge graph.

## Available Tools

### Query Code Structure (Natural Language)
Query the code graph with natural language questions about the code:
- "What functions call UserService.create_user?"
- "Show all classes that inherit from BaseModel"
- "What modules import the config module?"
- "What are the dependencies of PaymentProcessor?"

### Get Source Code by Qualified Name
Retrieve source code using dot-notation:
- \\\`app.services.UserService.create_user\\\`
- \\\`utils.validators.validate_email\\\`
- \\\`models.User\\\`

### Re-index Repository
Use when codebase has changed significantly. For incremental updates after small changes, use /update-graph instead.

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
