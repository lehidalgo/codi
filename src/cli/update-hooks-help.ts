/**
 * `codi update --hooks` — print next-steps for hook management.
 *
 * Lives in its own module so update.ts stays under the 800-line cap.
 */

export function printHooksHelp(out: NodeJS.WritableStream): void {
  out.write(
    [
      "Hook selection management:",
      "  codi hooks list                     # show all available hooks",
      "  codi hooks add <bucket> <name>      # enable a hook in this project",
      "  codi hooks remove <bucket> <name>   # disable a hook",
      "  codi init                            # re-run wizard to reselect hooks",
      "",
    ].join("\n"),
  );
}
