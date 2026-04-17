import {
  PROJECT_NAME,
  PROJECT_NAME_DISPLAY,
  SUPPORTED_PLATFORMS_YAML,
  SKILL_CATEGORY,
} from "#src/constants.js";
import type { TemplateCounts } from "../types.js";

function buildBrandPrompt(brandSkillNames: string[], projectName: string): string {
  const lines = brandSkillNames.map((name, i) => {
    const label = name.replace(/-brand$/, "");
    const brandLabel =
      label.length <= 4 ? label.toUpperCase() : label.charAt(0).toUpperCase() + label.slice(1);
    const suffix =
      i === 0
        ? " (default — uses bundled tokens)"
        : `  — requires ${projectName}-${name} skill active`;
    return `  ${i + 1}. ${brandLabel}${suffix}`;
  });
  lines.push(`  ${brandSkillNames.length + 1}. Custom — provide a path to brand_tokens.json`);
  return lines.join("\n");
}

export function getTemplate(counts: TemplateCounts): string {
  const brandPrompt = buildBrandPrompt(counts.brandSkillNames, PROJECT_NAME);
  return `---
name: {{name}}
description: |
  Create, edit, read, or fix spreadsheet files (.xlsx, .xlsm, .csv, .tsv).
  Use when the user wants to work with Excel, build a financial model,
  clean tabular data, generate a pivot table, apply formulas, or convert
  between tabular formats. Also activate for phrases like "Excel file",
  "spreadsheet", "financial model", "data cleaning", "pivot table",
  "formulas", "openpyxl", "csv to xlsx", "xlsx to csv", "messy tabular
  data". Handles .xlsx / .xlsm / .csv / .tsv via python (openpyxl) and
  TypeScript runtimes. Do NOT activate for Word documents (use
  ${PROJECT_NAME}-docx), PDF files (use ${PROJECT_NAME}-pdf),
  PowerPoint decks (use ${PROJECT_NAME}-pptx), branded HTML reports
  (use ${PROJECT_NAME}-doc-engine), or Google Sheets API integrations
  (use a gspread / Sheets API flow).
category: ${SKILL_CATEGORY.FILE_FORMAT_TOOLS}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 21
---

# {{name}} — XLSX

## When to Activate

- User wants to create, edit, read, or fix a \\\`.xlsx\\\`, \\\`.xlsm\\\`, \\\`.csv\\\`, or \\\`.tsv\\\` file
- User needs to clean or restructure messy tabular data
- User wants to build a financial model with formulas and color coding
- User needs to convert between tabular file formats

## Skip When

- User wants a Word document — use ${PROJECT_NAME}-docx
- User wants a PDF — use ${PROJECT_NAME}-pdf
- User wants a PowerPoint deck — use ${PROJECT_NAME}-pptx
- User wants a branded HTML report for PDF export — use ${PROJECT_NAME}-doc-engine
- User wants to call the Google Sheets API — use a gspread or Google Sheets API flow

# Requirements for Outputs

## All Excel files

### Professional Font
- Use a consistent, professional font (e.g., Arial, Times New Roman) for all deliverables unless otherwise instructed by the user

### Zero Formula Errors
- Every Excel model MUST be delivered with ZERO formula errors (#REF!, #DIV/0!, #VALUE!, #N/A, #NAME?)

### Preserve Existing Templates (when updating templates)
- Study and EXACTLY match existing format, style, and conventions when modifying files
- Never impose standardized formatting on files with established patterns
- Existing template conventions ALWAYS override these guidelines

## Financial models

Read \\\`\${CLAUDE_SKILL_DIR}[[/references/standards.md]]\\\` for color coding conventions, number formatting standards, formula construction rules, and hardcode documentation requirements.

# XLSX creation, editing, and analysis

## Overview

A user may ask you to create, edit, or analyze the contents of an .xlsx file. You have different tools and workflows available for different tasks.

## Important Requirements

**LibreOffice Required for Formula Recalculation**: You can assume LibreOffice is installed for recalculating formula values using the \\\`\${CLAUDE_SKILL_DIR}[[/scripts/recalc.py]]\\\` script. The script automatically configures LibreOffice on first run, including in sandboxed environments where Unix sockets are restricted (handled by \\\`\${CLAUDE_SKILL_DIR}[[/scripts/office/soffice.py]]\\\`)

## Reading and analyzing data

### Data analysis with pandas
For data analysis, visualization, and basic operations, use **pandas** which provides powerful data manipulation capabilities:

\\\`\\\`\\\`python
import pandas as pd

# Read Excel
df = pd.read_excel('file.xlsx')  # Default: first sheet
all_sheets = pd.read_excel('file.xlsx', sheet_name=None)  # All sheets as dict

# Analyze
df.head()      # Preview data
df.info()      # Column info
df.describe()  # Statistics

# Write Excel
df.to_excel('output.xlsx', index=False)
\\\`\\\`\\\`

## Excel File Workflows

## CRITICAL: Use Formulas, Not Hardcoded Values

**Always use Excel formulas instead of calculating values in Python and hardcoding them.** This ensures the spreadsheet remains dynamic and updateable.

### WRONG - Hardcoding Calculated Values
\\\`\\\`\\\`python
# Bad: Calculating in Python and hardcoding result
total = df['Sales'].sum()
sheet['B10'] = total  # Hardcodes 5000

# Bad: Computing growth rate in Python
growth = (df.iloc[-1]['Revenue'] - df.iloc[0]['Revenue']) / df.iloc[0]['Revenue']
sheet['C5'] = growth  # Hardcodes 0.15

# Bad: Python calculation for average
avg = sum(values) / len(values)
sheet['D20'] = avg  # Hardcodes 42.5
\\\`\\\`\\\`

### CORRECT - Using Excel Formulas
\\\`\\\`\\\`python
# Good: Let Excel calculate the sum
sheet['B10'] = '=SUM(B2:B9)'

# Good: Growth rate as Excel formula
sheet['C5'] = '=(C4-C2)/C2'

# Good: Average using Excel function
sheet['D20'] = '=AVERAGE(D2:D19)'
\\\`\\\`\\\`

This applies to ALL calculations - totals, percentages, ratios, differences, etc. The spreadsheet should be able to recalculate when source data changes.

## Common Workflow
1. **Choose tool**: pandas for data, openpyxl for formulas/formatting
2. **Create/Load**: Create new workbook or load existing file
3. **Modify**: Add/edit data, formulas, and formatting
4. **Save**: Write to file
5. **Recalculate formulas (MANDATORY IF USING FORMULAS)**: Use the \${CLAUDE_SKILL_DIR}[[/scripts/recalc.py]] script
   \\\`\\\`\\\`bash
   python \${CLAUDE_SKILL_DIR}[[/scripts/recalc.py]] output.xlsx
   \\\`\\\`\\\`
6. **Verify and fix any errors**:
   - The script returns JSON with error details
   - If \\\`status\\\` is \\\`errors_found\\\`, check \\\`error_summary\\\` for specific error types and locations
   - Fix the identified errors and recalculate again
   - Common errors to fix:
     - \\\`#REF!\\\`: Invalid cell references
     - \\\`#DIV/0!\\\`: Division by zero
     - \\\`#VALUE!\\\`: Wrong data type in formula
     - \\\`#NAME?\\\`: Unrecognized formula name

## Creating Branded Output

When the user asks to create a branded XLSX, ask two questions if not already stated:

**Step 1 — Brand** (skip if brand already named):
\`\`\`
Which brand styling would you like to apply?
${brandPrompt}
\`\`\`

**Step 2 — Theme** (skip if theme already named):
\`\`\`
Which color theme?
  1. Dark (default)
  2. Light
\`\`\`

Then run (detect runtime first):
\`\`\`bash
if command -v npx &>/dev/null && npx tsx --version &>/dev/null 2>&1; then
  # TypeScript (preferred)
  npx tsx \${CLAUDE_SKILL_DIR}[[/scripts/ts/generate_xlsx.ts]] --content content.json --tokens /path/to/brand_tokens.json --theme dark --output output.xlsx
elif command -v uv &>/dev/null; then
  # Python via uv (ephemeral isolated env — no system pollution)
  uv run --with openpyxl python3 \${CLAUDE_SKILL_DIR}[[/scripts/python/generate_xlsx.py]] --content content.json --tokens /path/to/brand_tokens.json --theme dark --output output.xlsx
else
  # Python via venv fallback
  SKILL_VENV="/tmp/${PROJECT_NAME}-skill-venv" && python3 -m venv "\$SKILL_VENV" 2>/dev/null || true
  "\$SKILL_VENV/bin/pip" install -q openpyxl
  "\$SKILL_VENV/bin/python3" \${CLAUDE_SKILL_DIR}[[/scripts/python/generate_xlsx.py]] --content content.json --tokens /path/to/brand_tokens.json --theme dark --output output.xlsx
fi
\`\`\`

Omit \`--tokens\` to use ${PROJECT_NAME_DISPLAY} default brand. Replace \`dark\` with \`light\` for the light theme.

---

### Creating new Excel files

\\\`\\\`\\\`python
# Using openpyxl for formulas and formatting
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment

wb = Workbook()
sheet = wb.active

# Add data
sheet['A1'] = 'Hello'
sheet['B1'] = 'World'
sheet.append(['Row', 'of', 'data'])

# Add formula
sheet['B2'] = '=SUM(A1:A10)'

# Formatting
sheet['A1'].font = Font(bold=True, color='FF0000')
sheet['A1'].fill = PatternFill('solid', start_color='FFFF00')
sheet['A1'].alignment = Alignment(horizontal='center')

# Column width
sheet.column_dimensions['A'].width = 20

wb.save('output.xlsx')
\\\`\\\`\\\`

### Editing existing Excel files

\\\`\\\`\\\`python
# Using openpyxl to preserve formulas and formatting
from openpyxl import load_workbook

# Load existing file
wb = load_workbook('existing.xlsx')
sheet = wb.active  # or wb['SheetName'] for specific sheet

# Working with multiple sheets
for sheet_name in wb.sheetnames:
    sheet = wb[sheet_name]
    print(f"Sheet: {sheet_name}")

# Modify cells
sheet['A1'] = 'New Value'
sheet.insert_rows(2)  # Insert row at position 2
sheet.delete_cols(3)  # Delete column 3

# Add new sheet
new_sheet = wb.create_sheet('NewSheet')
new_sheet['A1'] = 'Data'

wb.save('modified.xlsx')
\\\`\\\`\\\`

## Recalculating formulas

Excel files created or modified by openpyxl contain formulas as strings but not calculated values. Use the provided \\\`\${CLAUDE_SKILL_DIR}[[/scripts/recalc.py]]\\\` script to recalculate formulas:

\\\`\\\`\\\`bash
python \${CLAUDE_SKILL_DIR}[[/scripts/recalc.py]] <excel_file> [timeout_seconds]
\\\`\\\`\\\`

Example:
\\\`\\\`\\\`bash
python \${CLAUDE_SKILL_DIR}[[/scripts/recalc.py]] output.xlsx 30
\\\`\\\`\\\`

The script:
- Automatically sets up LibreOffice macro on first run
- Recalculates all formulas in all sheets
- Scans ALL cells for Excel errors (#REF!, #DIV/0!, etc.)
- Returns JSON with detailed error locations and counts
- Works on both Linux and macOS

## Formula Verification Checklist

Quick checks to ensure formulas work correctly:

### Essential Verification
- [ ] **Test 2-3 sample references**: Verify they pull correct values before building full model
- [ ] **Column mapping**: Confirm Excel columns match (e.g., column 64 = BL, not BK)
- [ ] **Row offset**: Remember Excel rows are 1-indexed (DataFrame row 5 = Excel row 6)

### Common Pitfalls
- [ ] **NaN handling**: Check for null values with \\\`pd.notna()\\\`
- [ ] **Far-right columns**: FY data often in columns 50+
- [ ] **Multiple matches**: Search all occurrences, not just first
- [ ] **Division by zero**: Check denominators before using \\\`/\\\` in formulas (#DIV/0!)
- [ ] **Wrong references**: Verify all cell references point to intended cells (#REF!)
- [ ] **Cross-sheet references**: Use correct format (Sheet1!A1) for linking sheets

### Formula Testing Strategy
- [ ] **Start small**: Test formulas on 2-3 cells before applying broadly
- [ ] **Verify dependencies**: Check all cells referenced in formulas exist
- [ ] **Test edge cases**: Include zero, negative, and very large values

### Interpreting \\\`\${CLAUDE_SKILL_DIR}[[/scripts/recalc.py]]\\\` Output
The script returns JSON with error details:
\\\`\\\`\\\`json
{
  "status": "success",           // or "errors_found"
  "total_errors": 0,              // Total error count
  "total_formulas": 42,           // Number of formulas in file
  "error_summary": {              // Only present if errors found
    "#REF!": {
      "count": 2,
      "locations": ["Sheet1!B5", "Sheet1!C10"]
    }
  }
}
\\\`\\\`\\\`

## Best Practices

### Library Selection
- **pandas**: Best for data analysis, bulk operations, and simple data export
- **openpyxl**: Best for complex formatting, formulas, and Excel-specific features

### Working with openpyxl
- Cell indices are 1-based (row=1, column=1 refers to cell A1)
- Use \\\`data_only=True\\\` to read calculated values: \\\`load_workbook('file.xlsx', data_only=True)\\\`
- **Warning**: If opened with \\\`data_only=True\\\` and saved, formulas are replaced with values and permanently lost
- For large files: Use \\\`read_only=True\\\` for reading or \\\`write_only=True\\\` for writing
- Formulas are preserved but not evaluated - use \\\`\${CLAUDE_SKILL_DIR}[[/scripts/recalc.py]]\\\` to update values

### Working with pandas
- Specify data types to avoid inference issues: \\\`pd.read_excel('file.xlsx', dtype={'id': str})\\\`
- For large files, read specific columns: \\\`pd.read_excel('file.xlsx', usecols=['A', 'C', 'E'])\\\`
- Handle dates properly: \\\`pd.read_excel('file.xlsx', parse_dates=['date_column'])\\\`

## Code Style Guidelines
**IMPORTANT**: When generating Python code for Excel operations:
- Write minimal, concise Python code without unnecessary comments
- Avoid verbose variable names and redundant operations
- Avoid unnecessary print statements

**For Excel files themselves**:
- Add comments to cells with complex formulas or important assumptions
- Document data sources for hardcoded values
- Include notes for key calculations and model sections
`;
}
