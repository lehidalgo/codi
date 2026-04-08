---
editUrl: false
next: false
prev: false
title: "isOk"
---

```ts
function isOk<T, E>(result): result is { data: T; ok: true };
```

Defined in: [types/result.ts:15](https://github.com/lehidalgo/codi/blob/a2252a5e49d54b1212428345e273dc06c8f61bb0/src/types/result.ts#L15)

## Type Parameters

<table>
<thead>
<tr>
<th>Type Parameter</th>
</tr>
</thead>
<tbody>
<tr>
<td>

`T`

</td>
</tr>
<tr>
<td>

`E`

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

`result`

</td>
<td>

[`Result`](/codi/docs/api/types/type-aliases/result/)\<`T`, `E`\>

</td>
</tr>
</tbody>
</table>

## Returns

`result is { data: T; ok: true }`
