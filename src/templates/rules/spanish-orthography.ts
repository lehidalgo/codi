import { PROJECT_NAME } from "../../constants.js";

export const template = `---
name: {{name}}
description: Spanish language orthography enforcement — accents, tildes, punctuation
priority: low
alwaysApply: false
managed_by: ${PROJECT_NAME}
---

# Spanish Orthography

## Core Rule
When content is in Spanish, ALWAYS write with correct orthography.

## Accents & Diacritics
- Always use accents where required on vowels: \u00e1, \u00e9, \u00ed, \u00f3, \u00fa

BAD: informacion, codigo, funcion, parametro, configuracion, autenticacion
GOOD: informaci\u00f3n, c\u00f3digo, funci\u00f3n, par\u00e1metro, configuraci\u00f3n, autenticaci\u00f3n

- Always use tilde on \u00f1

BAD: ano, diseno, espanol
GOOD: a\u00f1o, dise\u00f1o, espa\u00f1ol

- Always use dieresis where required: \u00fc (e.g., biling\u00fce, ping\u00fcino)
- Follow accentuation rules: agudas, llanas, esdr\u00fajulas, and sobresdr\u00fajulas

## Punctuation
- Use inverted question marks: \u00bfPregunta?
- Use inverted exclamation marks: \u00a1Exclamaci\u00f3n!
- Use Latin quotation marks (\u00ab\u00bb) when appropriate

## Applies To
- Documentation files
- Code comments
- Commit messages
- Descriptive filenames
- All communication with the user in Spanish`;
