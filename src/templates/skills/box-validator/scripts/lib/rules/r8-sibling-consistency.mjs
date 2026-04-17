// Rule 8: SIBLING CONSISTENCY — structurally equivalent sibling parents must
// have children at matching positions with matching dimensions. Uses the
// sibling groups already computed by tree-walker (explicit via data-box-group
// or implicit via fingerprint match).

export const id = "R8";
export const name = "Sibling Consistency";

export function check(_root, context, siblingGroups) {
  const violations = [];
  for (const group of siblingGroups) {
    checkGroup(group, context, violations);
  }
  return violations;
}

function checkGroup(group, context, out) {
  const tol = context.tolerance;
  const errorTol = context.errorTolerance;

  for (let idx = 0; idx < group.childCount; idx++) {
    // Collect the child at index `idx` from every group member
    const cells = group.members
      .map((m) => ({ parent: m, child: m.children[idx] }))
      .filter((c) => c.child);

    if (cells.length < 2) continue;

    compareDim(cells, "w", "width", tol, errorTol, out);
    compareDim(cells, "h", "height", tol, errorTol, out);
    compareRelPos(cells, "x", "x-offset", tol, errorTol, out);
    compareRelPos(cells, "y", "y-offset", tol, errorTol, out);
  }
}

function compareDim(cells, key, label, tol, errorTol, out) {
  const values = cells.map((c) => c.child.rect[key]);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  for (let i = 0; i < cells.length; i++) {
    const delta = Math.abs(values[i] - avg);
    if (delta > tol) {
      out.push({
        rule: "R8",
        severity: delta > errorTol ? "error" : "warning",
        path: cells[i].child.path,
        message: `${label} ${values[i].toFixed(1)}px ≠ sibling group avg ${avg.toFixed(1)}px (Δ${delta.toFixed(1)}px)`,
        fix: `Children of sibling parents (group "${cells[i].parent.dataBoxGroup || cells[i].parent.fingerprint}") must share dimensions. Use a shared class or CSS variable.`,
      });
    }
  }
}

function compareRelPos(cells, key, label, tol, errorTol, out) {
  // Compare child position relative to its own parent
  const rels = cells.map((c) => c.child.rect[key] - c.parent.rect[key]);
  const avg = rels.reduce((a, b) => a + b, 0) / rels.length;
  for (let i = 0; i < cells.length; i++) {
    const delta = Math.abs(rels[i] - avg);
    if (delta > tol) {
      out.push({
        rule: "R8",
        severity: delta > errorTol ? "error" : "warning",
        path: cells[i].child.path,
        message: `relative ${label} ${rels[i].toFixed(1)}px ≠ sibling group avg ${avg.toFixed(1)}px`,
        fix: "Sibling parents must place their children at the same relative offset. Check for extra padding, margins, or order differences.",
      });
    }
  }
}
