---
editUrl: false
next: false
prev: false
title: "err"
---

```ts
function err<E>(errors): Result<never, E>;
```

Defined in: [types/result.ts:11](https://github.com/lehidalgo/codi/blob/a2252a5e49d54b1212428345e273dc06c8f61bb0/src/types/result.ts#L11)

## Type Parameters

<table>
<thead>
<tr>
<th>Type Parameter</th>
<th>Default type</th>
</tr>
</thead>
<tbody>
<tr>
<td>

`E`

</td>
<td>

`ProjectError`[]

</td>
</tr>
</tbody>
</table>

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

`errors`

</td>
<td>

`E`

</td>
</tr>
</tbody>
</table>

## Returns

[`Result`](/codi/docs/api/types/type-aliases/result/)\<`never`, `E`\>
