---
editUrl: false
next: false
prev: false
title: "FeedbackEntry"
---

```ts
type FeedbackEntry = object;
```

Defined in: [schemas/feedback.ts:44](https://github.com/lehidalgo/codi/blob/a2252a5e49d54b1212428345e273dc06c8f61bb0/src/schemas/feedback.ts#L44)

## Type Declaration

### agent

```ts
agent: "claude-code" | "cursor" | "codex" | "windsurf" | "cline";
```

### id

```ts
id: string;
```

### issues

```ts
issues: object[];
```

### outcome

```ts
outcome: "success" | "partial" | "failure";
```

### skillName

```ts
skillName: string;
```

### suggestions

```ts
suggestions: string[];
```

### taskSummary

```ts
taskSummary: string;
```

### timestamp

```ts
timestamp: string;
```
