import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("vitest config", () => {
  it("scopes default test scripts to source test files only", () => {
    const packageJsonPath = path.resolve(process.cwd(), "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      scripts?: Record<string, string>;
    };
    expect(packageJson.scripts?.test ?? "").toContain("--dir tests");
    expect(packageJson.scripts?.["test:watch"] ?? "").toContain("--dir tests");
    expect(packageJson.scripts?.["test:coverage"] ?? "").toContain("--dir tests");
    expect(packageJson.scripts?.["test:integration"] ?? "").toContain("--dir tests/integration");
    expect(packageJson.scripts?.["test:e2e"] ?? "").toContain("--dir tests/e2e");
    expect(packageJson.scripts?.test ?? "").toContain("e2e/**");
    expect(packageJson.scripts?.["test:watch"] ?? "").toContain("e2e/**");
    expect(packageJson.scripts?.["test:coverage"] ?? "").toContain("e2e/**");
  });

  it("prevents emitting compiled test files into dist", () => {
    const tsconfigBuildPath = path.resolve(process.cwd(), "tsconfig.build.json");
    const tsconfigBuild = JSON.parse(readFileSync(tsconfigBuildPath, "utf8")) as {
      include?: string[];
    };

    expect(tsconfigBuild.include).toEqual(["src/**/*.ts"]);
    expect(tsconfigBuild.include?.some((entry) => entry.includes("tests")) ?? false).toBe(false);
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
    expect(packageJson.version ?? "").toMatch(
      /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/
    );
    expect(packageJson.version).not.toBe("0.1.0");
    expect(packageJson.bin).toEqual({ luckybox: "./bin/run.js" });
    expect(packageJson.oclif?.bin).toBe("luckybox");
    expect(packageJson.scripts?.luckybox ?? "").toContain("node ./bin/run.js");
    expect(packageJson.scripts?.vault).toBeUndefined();
    expect(packageJson.scripts?.changeset).toBe("changeset");
    expect(packageJson.scripts?.["release:check"] ?? "").toContain("pnpm run typecheck");
    expect(packageJson.scripts?.["release:check"] ?? "").toContain("pnpm run lint");
    expect(packageJson.scripts?.["release:check"] ?? "").toContain("pnpm run format:check");
    expect(packageJson.scripts?.["release:check"] ?? "").toContain("pnpm run test");
    expect(packageJson.scripts?.["release:check"] ?? "").toContain("pnpm run build");
    expect(packageJson.scripts?.["release:check"] ?? "").toContain("npm pack --dry-run");
    expect(packageJson.scripts?.["release:publish"] ?? "").toContain("changeset publish");
    expect(packageJson.scripts?.prepublishOnly).toBe("pnpm run release:check");
    expect(packageJson.files).toEqual(["bin", "dist", "README.md"]);
  });
});
