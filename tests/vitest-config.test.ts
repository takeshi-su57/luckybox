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

  it("enforces publish metadata and luckybox cli entrypoint contract", () => {
    const packageJsonPath = path.resolve(process.cwd(), "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      private?: boolean;
      version?: string;
      bin?: Record<string, string>;
      oclif?: { bin?: string };
      scripts?: Record<string, string>;
      files?: string[];
    };

    expect(packageJson.private).toBe(false);
    expect(packageJson.version).toBe("0.1.1");
    expect(packageJson.bin).toEqual({ luckybox: "./bin/run.js" });
    expect(packageJson.oclif?.bin).toBe("luckybox");
    expect(packageJson.scripts?.luckybox ?? "").toContain("node ./bin/run.js");
    expect(packageJson.scripts?.vault).toBeUndefined();
    expect(packageJson.scripts?.changeset).toBe("changeset");
    expect(packageJson.scripts?.["release:check"] ?? "").toContain("pnpm run build");
    expect(packageJson.scripts?.["release:check"] ?? "").toContain("pnpm pack --dry-run");
    expect(packageJson.scripts?.["release:publish"] ?? "").toContain("changeset publish");
    expect(packageJson.scripts?.prepublishOnly).toBe("pnpm run release:check");
    expect(packageJson.files).toEqual(["bin", "dist", "README.md"]);
  });
});
