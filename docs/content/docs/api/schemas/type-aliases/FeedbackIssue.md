---
editUrl: false
next: false
prev: false
title: "FeedbackIssue"
---

```ts
type FeedbackIssue = object;
```

Defined in: [schemas/feedback.ts:43](https://github.com/lehidalgo/codi/blob/a2252a5e49d54b1212428345e273dc06c8f61bb0/src/schemas/feedback.ts#L43)

## Type Declaration

### category

```ts
category: 
  | "trigger-miss"
  | "trigger-false"
  | "unclear-step"
  | "missing-step"
  | "wrong-output"
  | "context-overflow"
  | "other";
```

### description

```ts
description: string;
```

### severity

```ts
severity: "high" | "medium" | "low";
```
