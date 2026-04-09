---
editUrl: false
next: false
prev: false
title: "Result"
---

```ts
type Result<T, E> = 
  | {
  data: T;
  ok: true;
}
  | {
  errors: E;
  ok: false;
};
```

Defined in: [types/result.ts:3](https://github.com/lehidalgo/codi/blob/a2252a5e49d54b1212428345e273dc06c8f61bb0/src/types/result.ts#L3)

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

`T`

</td>
<td>

&hyphen;

</td>
</tr>
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
