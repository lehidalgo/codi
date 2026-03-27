export const template = `---
name: {{name}}
description: Spanish language orthography enforcement — accents, tildes, punctuation
priority: low
alwaysApply: false
managed_by: codi
---

# Spanish Orthography

## Core Rule
When content is in Spanish, ALWAYS write with correct orthography.

## Accents & Diacritics
- Always use accents where required: a, e, i, o, u (informacion > informacion, codigo > codigo, funcion > funcion, parametro > parametro, configuracion > configuracion, autenticacion > autenticacion)
- Always use tildes: n (ano > ano)
- Always use dieresis where required: u (bilinguee > bilinguee)
- Follow accentuation rules: agudas, llanas, esdrujulas, and sobresdrujulas

## Punctuation
- Use inverted question marks: ?...?
- Use inverted exclamation marks: !...!
- Use Latin quotation marks when appropriate

## Applies To
- Documentation files
- Code comments
- Commit messages
- Descriptive filenames
- All communication with the user in Spanish`;
