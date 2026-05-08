import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readWorkflow(relativePath: string): string {
  const workflowPath = path.resolve(process.cwd(), relativePath);
  expect(existsSync(workflowPath)).toBe(true);
  return readFileSync(workflowPath, "utf8");
}

describe("release workflow contracts", () => {
  it("requires CI workflow triggers and core checks", () => {
    const ciWorkflow = readWorkflow(".github/workflows/ci.yml");

    expect(ciWorkflow).toMatch(/\bon:\s*[\r\n]+\s*pull_request:\s*[\r\n]+\s*push:/m);
    expect(ciWorkflow).toMatch(/\bpush:\s*[\r\n]+\s*branches:\s*[\r\n]+\s*-\s*main\b/m);
    expect(ciWorkflow).toMatch(/\bpnpm run typecheck\b/);
    expect(ciWorkflow).toMatch(/\bpnpm run lint\b/);
    expect(ciWorkflow).toMatch(/\bpnpm run format:check\b/);
    expect(ciWorkflow).toMatch(/\bpnpm test\b/);
    expect(ciWorkflow).toMatch(/\bpnpm run build\b/);
  });

  it("requires main-only release workflow with changesets and npm token", () => {
    const releaseWorkflow = readWorkflow(".github/workflows/release.yml");

    expect(releaseWorkflow).toMatch(/\bpush:\s*[\r\n]+\s*branches:\s*[\r\n]+\s*-\s*main\b/m);
    expect(releaseWorkflow).toContain("if: github.ref == 'refs/heads/main'");
    expect(releaseWorkflow).toContain("concurrency:");
    expect(releaseWorkflow).toMatch(/\bpermissions:\s*[\r\n]+\s*contents:\s*write\b/m);
    expect(releaseWorkflow).toMatch(/\bpermissions:\s*[\r\n]+\s*contents:\s*write\s*[\r\n]+\s*pull-requests:\s*write\b/m);
    expect(releaseWorkflow).toContain("changesets/action@v1");
    expect(releaseWorkflow).toContain("publish: pnpm run release:publish");
    expect(releaseWorkflow).toContain("NPM_TOKEN");
    expect(releaseWorkflow).toMatch(/\bpnpm run typecheck\b|\bpnpm run lint\b|\bpnpm test\b|\bpnpm run build\b/);
  });
});
