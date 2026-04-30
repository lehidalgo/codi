# codi-xlsx

Creates, edits, and analyzes spreadsheet files (`.xlsx`, `.xlsm`, `.csv`, `.tsv`). Supports formula authoring, financial models with color coding, data cleaning, and format conversion. Recalculates formula values via LibreOffice.

## Prerequisites

| Dependency  | Install                                 | Purpose                                                                                                                                             |
| ----------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Python 3.9+ | required                                | core runtime                                                                                                                                        |
| pandas      | `pip install pandas openpyxl`           | data analysis and reading                                                                                                                           |
| openpyxl    | `pip install openpyxl`                  | create and edit `.xlsx` files                                                                                                                       |
| xlsxwriter  | `pip install xlsxwriter`                | write `.xlsx` with rich formatting                                                                                                                  |
| LibreOffice | `brew install --cask libreoffice`       | recalculate formula values                                                                                                                          |
| Node.js     | optional                                | TypeScript xlsx utilities                                                                                                                           |
| exceljs     | `npm install exceljs` (in your project) | required by `scripts/ts/generate_xlsx.ts` — install in your own `package.json`; `codi-cli` no longer ships it as a runtime dependency since v2.14.1 |

Install core packages:

```bash
pip install pandas openpyxl xlsxwriter
```

## Scripts

| File                        | Purpose                                                     |
| --------------------------- | ----------------------------------------------------------- |
| `scripts/recalc.py`         | Trigger LibreOffice formula recalculation on a `.xlsx` file |
| `scripts/office/soffice.py` | LibreOffice wrapper — handles sandboxed environments        |
| `scripts/python/`           | Python spreadsheet utilities                                |
| `scripts/ts/`               | TypeScript spreadsheet utilities (run via `npx tsx`)        |
| `scripts/brand_tokens.json` | Brand colors and fonts for styled output                    |

## Formula Recalculation

Excel formulas written by Python libraries store expressions but not computed values. LibreOffice recalculates and saves the values so recipients see correct results on open:

```bash
python scripts/recalc.py output.xlsx
```

The script auto-configures LibreOffice on first run, including in sandboxed environments.

## Color Coding Convention

See `references/standards.md` for the full financial model color coding standard (hardcoded inputs, formulas, links, and assumptions).
