# Excel Standards Reference

## Color Coding Conventions

Industry-standard color conventions for financial models and data workbooks.

| Color | RGB | Meaning |
|-------|-----|---------|
| **Blue text** | `0,0,255` | Hardcoded inputs — numbers users will change for scenarios |
| **Black text** | `0,0,0` | ALL formulas and calculations |
| **Green text** | `0,128,0` | Links pulling from other worksheets within same workbook |
| **Red text** | `255,0,0` | External links to other files |
| **Yellow background** | `255,255,0` | Key assumptions needing attention, cells that need to be updated |

---

## Number Formatting Standards

| Data type | Format | Notes |
|-----------|--------|-------|
| Years | Text string (`"2024"`) | Never format as number (avoids `"2,024"`) |
| Currency | `$#,##0` | Always specify units in headers: `Revenue ($mm)` |
| Zeros | `$#,##0;($#,##0);-` | All zeros display as `-`, including percentages |
| Percentages | `0.0%` | One decimal by default |
| Multiples | `0.0x` | For valuation multiples: EV/EBITDA, P/E |
| Negative numbers | `(123)` | Parentheses, never minus sign |

---

## Formula Construction Rules

### Assumptions Placement

- Place ALL assumptions (growth rates, margins, multiples) in dedicated assumption cells
- Use cell references instead of hardcoded values in formulas

```
WRONG: =B5*1.05
RIGHT: =B5*(1+$B$6)   ← $B$6 holds the growth rate assumption
```

### Error Prevention Checklist

- [ ] All cell references point to intended cells (no `#REF!`)
- [ ] No division by zero risk — verify denominators (no `#DIV/0!`)
- [ ] Consistent formula range across all projection periods (no off-by-one errors)
- [ ] No unintended circular references
- [ ] Formulas tested with edge cases: zero values, negative numbers, large numbers

### Documenting Hardcoded Values

Any hardcoded value must be sourced. Format — comment in adjacent cell:

```
Source: [System/Document], [Date], [Specific Reference], [URL if applicable]
```

Examples:
- `Source: Company 10-K, FY2024, Page 45, Revenue Note, [SEC EDGAR URL]`
- `Source: Bloomberg Terminal, 8/15/2025, AAPL US Equity`
- `Source: FactSet, 8/20/2025, Consensus Estimates Screen`
