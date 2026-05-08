import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("vitest config", () => {
  it("scopes default test scripts to source test files only", () => {
    const packageJsonPath = path.resolve(process.cwd(), "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      scripts?: Record<string, string>;
    };
    expect(packageJson.scripts?.test ?? "").toContain(" tests");
    expect(packageJson.scripts?.["test:watch"] ?? "").toContain(" tests");
    expect(packageJson.scripts?.["test:coverage"] ?? "").toContain(" tests");
    expect(packageJson.scripts?.["test:integration"] ?? "").toContain(" tests/integration");
    expect(packageJson.scripts?.["test:e2e"] ?? "").toContain(" tests/e2e");
    expect(packageJson.scripts?.test ?? "").toContain("--exclude dist/**");
    expect(packageJson.scripts?.["test:watch"] ?? "").toContain("--exclude dist/**");
    expect(packageJson.scripts?.["test:coverage"] ?? "").toContain("--exclude dist/**");
    expect(packageJson.scripts?.["test:integration"] ?? "").toContain("--exclude dist/**");
    expect(packageJson.scripts?.["test:e2e"] ?? "").toContain("--exclude dist/**");
  });
});
