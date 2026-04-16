// Rule 2: FULL COVERAGE — children + spacing must fill the parent completely.
// When a container uses justify-content to distribute space intentionally,
// the main-axis check is downgraded to warning (Layer 2 CSS placement).

export const id = "R2";
export const name = "Full Coverage";

// justify-content values that intentionally distribute leftover space.
// When present, children are not expected to fill the main axis — the
// browser handles the remaining space via CSS positioning (Layer 2).
const DISTRIBUTING_JUSTIFY = new Set([
  "space-between",
  "space-around",
  "space-evenly",
  "center",
  "flex-end",
]);

export function check(root, context) {
  const violations = [];
  walk(root);
  return violations;

  function walk(n) {
    if (
      !n.isLeaf &&
      n.children.length > 0 &&
      n.flow !== "wrap" &&
      n.flow !== "grid" &&
      !n.isCompoundCohesion
    ) {
      checkNode(n, context, violations);
    }
    for (const c of n.children) walk(c);
  }
}

function checkNode(n, context, out) {
  const tol = context.tolerance;
  const padT = n.css.paddingTop;
  const padR = n.css.paddingRight;
  const padB = n.css.paddingBottom;
  const padL = n.css.paddingLeft;
  const gap = n.css.gap;
  const cn = n.children.length;
  const distributes = DISTRIBUTING_JUSTIFY.has(n.css.justifyContent);

  if (n.flow === "column") {
    const expected =
      padT + padB + n.children.reduce((s, c) => s + c.rect.h, 0) + gap * (cn - 1);
    const delta = Math.abs(n.rect.h - expected);
    if (delta > tol) {
      out.push({
        rule: "R2",
        severity: distributes ? "warning" : "error",
        path: n.path,
        message: `Column height ${n.rect.h.toFixed(1)}px ≠ children+spacing ${expected.toFixed(1)}px (Δ${delta.toFixed(1)}px)`,
        fix: distributes
          ? "Column uses justify-content to distribute space. Consider using flex children to fill the axis for tighter structure."
          : "Give every child `flex: 1` (or explicit heights) so they fill the parent. Verify there is no absolute-positioned ghost or hidden sibling.",
      });
    }
    const expectedW = n.rect.w - padL - padR;
    for (const c of n.children) {
      if (Math.abs(c.rect.w - expectedW) > tol) {
        out.push({
          rule: "R2",
          severity: "warning",
          path: c.path,
          message: `Child width ${c.rect.w.toFixed(1)}px ≠ parent inner width ${expectedW.toFixed(1)}px`,
          fix: "Remove fixed widths on children. Let flex distribute the cross axis.",
        });
      }
    }
  } else if (n.flow === "row") {
    const expected =
      padL + padR + n.children.reduce((s, c) => s + c.rect.w, 0) + gap * (cn - 1);
    const delta = Math.abs(n.rect.w - expected);
    if (delta > tol) {
      out.push({
        rule: "R2",
        severity: distributes ? "warning" : "error",
        path: n.path,
        message: `Row width ${n.rect.w.toFixed(1)}px ≠ children+spacing ${expected.toFixed(1)}px (Δ${delta.toFixed(1)}px)`,
        fix: distributes
          ? "Row uses justify-content to distribute space. Consider using flex children to fill the axis for tighter structure."
          : "Give every child `flex: 1` (or explicit widths) so they fill the parent.",
      });
    }
    const expectedH = n.rect.h - padT - padB;
    for (const c of n.children) {
      if (Math.abs(c.rect.h - expectedH) > tol) {
        out.push({
          rule: "R2",
          severity: "warning",
          path: c.path,
          message: `Child height ${c.rect.h.toFixed(1)}px ≠ parent inner height ${expectedH.toFixed(1)}px`,
          fix: "Remove fixed heights on children. Let flex distribute the cross axis.",
        });
      }
    }
  }
}
