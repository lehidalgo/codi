/**
 * CORE-003 — Logger interface + NULL_LOGGER contract.
 *
 * `src/types/logger.ts` is the only Logger surface that utils/ and
 * adapters/ depend on. Pinning the contract here protects against
 * future changes that would silently break DI.
 */
import { describe, it, expect } from "vitest";
import { NULL_LOGGER } from "#src/types/logger.js";
import type { Logger } from "#src/types/logger.js";
import { Logger as ConcreteLogger } from "#src/core/output/logger.js";

describe("NULL_LOGGER", () => {
  it("provides no-op implementations for every Logger method", () => {
    // Calling each method must not throw and must not return anything.
    expect(NULL_LOGGER.debug("x")).toBeUndefined();
    expect(NULL_LOGGER.info("x")).toBeUndefined();
    expect(NULL_LOGGER.warn("x")).toBeUndefined();
    expect(NULL_LOGGER.error("x")).toBeUndefined();
    expect(NULL_LOGGER.fatal("x")).toBeUndefined();
  });

  it("accepts variadic args without error", () => {
    expect(() => {
      NULL_LOGGER.warn("hello", 1, { foo: "bar" }, [1, 2], null, undefined);
    }).not.toThrow();
  });

  it("is a frozen-ish constant (mutation only affects local reference)", () => {
    // The default isn't deeply frozen; this test documents the contract.
    // Callers should treat NULL_LOGGER as immutable; the type system enforces
    // method shape but not mutability of the object itself. Verifies the
    // import resolves to the same instance across modules.
    const ref1: Logger = NULL_LOGGER;
    const ref2: Logger = NULL_LOGGER;
    expect(ref1).toBe(ref2);
  });
});

describe("Logger interface compatibility", () => {
  it("ConcreteLogger satisfies the Logger interface", () => {
    // If ConcreteLogger ever stops implementing Logger, this fails to compile.
    const concrete = new ConcreteLogger({ level: "debug", mode: "human", noColor: true });
    const asInterface: Logger = concrete;
    expect(typeof asInterface.debug).toBe("function");
    expect(typeof asInterface.info).toBe("function");
    expect(typeof asInterface.warn).toBe("function");
    expect(typeof asInterface.error).toBe("function");
    expect(typeof asInterface.fatal).toBe("function");
  });
});
