---
editUrl: false
next: false
prev: false
title: "flagsFromDefinitions"
---

```ts
function flagsFromDefinitions(defs, source): ResolvedFlags;
```

Defined in: [core/config/composer.ts:6](https://github.com/lehidalgo/codi/blob/a2252a5e49d54b1212428345e273dc06c8f61bb0/src/core/config/composer.ts#L6)

Converts raw flag definitions into resolved flags with source tracking.

## Parameters

<table>
<thead>
<tr>
<th>Parameter</th>
<th>Type</th>
</tr>
</thead>
<tbody>
<tr>
<td>

`defs`

</td>
<td>

`Record`\<`string`, [`FlagDefinition`](/codi/docs/api/types/interfaces/flagdefinition/)\>

</td>
</tr>
<tr>
<td>

`source`

</td>
<td>

`string`

</td>
</tr>
</tbody>
</table>

## Returns

[`ResolvedFlags`](/codi/docs/api/types/interfaces/resolvedflags/)
