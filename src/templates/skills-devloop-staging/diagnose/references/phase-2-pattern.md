# Phase 2 — Pattern analysis

Find the pattern before fixing. Read working code. Compare. Identify differences.

## 1. Find working examples

- Locate similar working code in the same codebase.
- What works that is similar to what is broken?
- If reading external references, read them COMPLETELY — do NOT skim.

## 2. Compare against references

- If implementing a pattern, read the reference implementation completely.
- Don't skim. Read every line.
- Understand the pattern fully BEFORE applying.

## 3. Identify differences

- What is different between working and broken?
- List EVERY difference, however small.
- Don't assume "that can't matter".

## 4. Understand dependencies

- What other components does this need?
- What settings, config, environment?
- What assumptions does it make?

## Exit criterion

You may proceed to Phase 3 only when:

- [ ] You can name a working analog in the codebase or reference.
- [ ] You have a list of every difference between working and broken.
- [ ] You understand the dependencies (config, environment, surrounding code) the broken case relies on.
