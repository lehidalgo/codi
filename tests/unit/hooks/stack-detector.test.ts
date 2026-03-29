import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { detectStack } from "#src/core/hooks/stack-detector.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "codi-stack-"));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("detectStack", () => {
  it("returns empty array for empty project", async () => {
    const result = await detectStack(tmpDir);
    expect(result).toEqual([]);
  });

  it("detects typescript from tsconfig.json", async () => {
    await fs.writeFile(path.join(tmpDir, "tsconfig.json"), "{}");
    const result = await detectStack(tmpDir);
    expect(result).toContain("typescript");
  });

  it("detects javascript from package.json", async () => {
    await fs.writeFile(path.join(tmpDir, "package.json"), "{}");
    const result = await detectStack(tmpDir);
    expect(result).toContain("javascript");
  });

  it("detects python from pyproject.toml", async () => {
    await fs.writeFile(path.join(tmpDir, "pyproject.toml"), "");
    const result = await detectStack(tmpDir);
    expect(result).toContain("python");
  });

  it("detects python from requirements.txt", async () => {
    await fs.writeFile(path.join(tmpDir, "requirements.txt"), "");
    const result = await detectStack(tmpDir);
    expect(result).toContain("python");
  });

  it("deduplicates python when both indicators exist", async () => {
    await fs.writeFile(path.join(tmpDir, "pyproject.toml"), "");
    await fs.writeFile(path.join(tmpDir, "requirements.txt"), "");
    const result = await detectStack(tmpDir);
    const pythonCount = result.filter((l) => l === "python").length;
    expect(pythonCount).toBe(1);
  });

  it("detects go from go.mod", async () => {
    await fs.writeFile(path.join(tmpDir, "go.mod"), "");
    const result = await detectStack(tmpDir);
    expect(result).toContain("go");
  });

  it("detects rust from Cargo.toml", async () => {
    await fs.writeFile(path.join(tmpDir, "Cargo.toml"), "");
    const result = await detectStack(tmpDir);
    expect(result).toContain("rust");
  });

  it("detects java from pom.xml", async () => {
    await fs.writeFile(path.join(tmpDir, "pom.xml"), "");
    const result = await detectStack(tmpDir);
    expect(result).toContain("java");
  });

  it("detects kotlin from build.gradle", async () => {
    await fs.writeFile(path.join(tmpDir, "build.gradle"), "");
    const result = await detectStack(tmpDir);
    expect(result).toContain("kotlin");
  });

  it("detects kotlin from build.gradle.kts", async () => {
    await fs.writeFile(path.join(tmpDir, "build.gradle.kts"), "");
    const result = await detectStack(tmpDir);
    expect(result).toContain("kotlin");
  });

  it("detects swift from Package.swift", async () => {
    await fs.writeFile(path.join(tmpDir, "Package.swift"), "");
    const result = await detectStack(tmpDir);
    expect(result).toContain("swift");
  });

  it("detects php from composer.json", async () => {
    await fs.writeFile(path.join(tmpDir, "composer.json"), "{}");
    const result = await detectStack(tmpDir);
    expect(result).toContain("php");
  });

  it("detects ruby from Gemfile", async () => {
    await fs.writeFile(path.join(tmpDir, "Gemfile"), "");
    const result = await detectStack(tmpDir);
    expect(result).toContain("ruby");
  });

  it("detects dart from pubspec.yaml", async () => {
    await fs.writeFile(path.join(tmpDir, "pubspec.yaml"), "");
    const result = await detectStack(tmpDir);
    expect(result).toContain("dart");
  });

  it("detects cpp from CMakeLists.txt", async () => {
    await fs.writeFile(path.join(tmpDir, "CMakeLists.txt"), "");
    const result = await detectStack(tmpDir);
    expect(result).toContain("cpp");
  });

  it("detects csharp from .csproj file", async () => {
    await fs.writeFile(path.join(tmpDir, "MyApp.csproj"), "");
    const result = await detectStack(tmpDir);
    expect(result).toContain("csharp");
  });

  it("detects csharp from .sln file", async () => {
    await fs.writeFile(path.join(tmpDir, "MyApp.sln"), "");
    const result = await detectStack(tmpDir);
    expect(result).toContain("csharp");
  });

  it("does not detect csharp without .csproj or .sln", async () => {
    await fs.writeFile(path.join(tmpDir, "package.json"), "{}");
    const result = await detectStack(tmpDir);
    expect(result).not.toContain("csharp");
  });

  it("detects multiple languages in a polyglot project", async () => {
    await fs.writeFile(path.join(tmpDir, "package.json"), "{}");
    await fs.writeFile(path.join(tmpDir, "tsconfig.json"), "{}");
    await fs.writeFile(path.join(tmpDir, "composer.json"), "{}");
    await fs.writeFile(path.join(tmpDir, "Gemfile"), "");
    const result = await detectStack(tmpDir);
    expect(result).toContain("javascript");
    expect(result).toContain("typescript");
    expect(result).toContain("php");
    expect(result).toContain("ruby");
  });
});
