# Per-term format for the proposal

Each candidate term in the bootstrap proposal uses this shape:

```
N. <Term>
   Definition: <one to two sentences in plain language>
   Evidence: <file:line> showing the term in use
   Avoid: <other terms the user might confuse this with>
```

## Categories

Group candidates by category for readability:

| Category            | Examples                                      |
| ------------------- | --------------------------------------------- |
| **Entities**        | Order, Customer, Workflow, Manifest           |
| **Actions**         | Reproduce, Decompose, Verify, Migrate         |
| **Roles**           | Reviewer, Implementer, Maintainer             |
| **Domain concepts** | Tracer-bullet slice, Deletion test, HARD GATE |

## Approval format

Present the list to the human with three actions per term:

- Approve as-is
- Edit the definition
- Reject (not really a domain term, just internal naming)

Wait for explicit approval per term. Do not skip this. Disagreements about vocabulary are not edge cases — they are the whole point of having a glossary.

## Quality bar

- **Definition**: in plain language. If the definition needs jargon, define the jargon first.
- **Evidence**: a real `file:line` reference, not paraphrased.
- **Avoid**: only when there is genuine confusion risk. Empty when the term is unique.

## Quantity bar

5–15 terms in the initial set. Less than 5 → glossary too sparse to be useful. More than 15 → noise; the glossary will be ignored.

The list grows inline during workflows. Bootstrap is the seed.
