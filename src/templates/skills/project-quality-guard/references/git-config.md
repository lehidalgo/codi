# Git Configuration Reference

## .gitattributes — Line Ending Normalization

Forces LF on all text files regardless of OS. Prevents phantom CRLF diffs.

```
# Auto-detect text files, normalize to LF
* text=auto eol=lf

# Explicit text files
*.py    text eol=lf
*.ts    text eol=lf
*.tsx   text eol=lf
*.js    text eol=lf
*.jsx   text eol=lf
*.json  text eol=lf
*.yaml  text eol=lf
*.yml   text eol=lf
*.md    text eol=lf
*.css   text eol=lf
*.html  text eol=lf
*.sql   text eol=lf
*.toml  text eol=lf
*.cfg   text eol=lf
*.ini   text eol=lf
*.sh    text eol=lf

# Binary files — no conversion
*.png  binary
*.jpg  binary
*.jpeg binary
*.gif  binary
*.ico  binary
*.woff binary
*.woff2 binary
*.ttf  binary
*.eot  binary
*.pdf  binary
```

**Verification:** `git ls-files --eol | grep -v "i/lf"` — should return nothing for text files.

**After adding .gitattributes to existing repo:** Run `git add --renormalize .` to fix existing files.

---

## .gitignore — Comprehensive Template

### Python projects
```gitignore
# Virtual environments
.venv/
venv/
env/

# Python caches
__pycache__/
*.py[cod]
*.pyo
*.egg-info/
dist/
build/

# Type checking / lint caches
.mypy_cache/
.ruff_cache/
.pytest_cache/

# Coverage
.coverage
htmlcov/

# Environment files (SECRETS)
.env
.env.*
!.env.example
```

### Node/TypeScript projects
```gitignore
# Dependencies
node_modules/

# Build output
dist/
build/
.next/
.nuxt/

# Vite cache
.vite/

# Environment files (SECRETS)
.env
.env.local
.env.*.local
!.env.example
!.env.local.example

# TypeScript cache
*.tsbuildinfo
```

### Common (all projects)
```gitignore
# IDE
.idea/
.vscode/
*.swp
*.swo
*~

# OS files
.DS_Store
Thumbs.db
desktop.ini

# Logs
*.log
npm-debug.log*

# Local config
.claude/
```

---

## .editorconfig — Editor-Agnostic Formatting

```ini
root = true

[*]
end_of_line = lf
insert_final_newline = true
charset = utf-8
indent_style = space
trim_trailing_whitespace = true

[*.py]
indent_size = 4

[*.{ts,tsx,js,jsx,json,yaml,yml,css,html,vue,svelte}]
indent_size = 2

[*.md]
trim_trailing_whitespace = false

[Makefile]
indent_style = tab

[*.go]
indent_style = tab
```

**Why .editorconfig matters:** It ensures files are created with correct formatting from the start, before any linter runs. Works in VS Code, Vim, IntelliJ, Sublime, etc. (some need a plugin).
