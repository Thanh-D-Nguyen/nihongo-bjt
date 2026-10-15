import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("Learning Paths mobile table", () => {
  it("contains the wide table in its own horizontal scroller", () => {
    const path = fileURLToPath(new URL("./learning-paths-client.tsx", import.meta.url));
    const source = readFileSync(path, "utf8");
    expect(source).toMatch(/overflow-x-auto/);
    expect(source).toMatch(/<div[^>]*overflow-x-auto[^>]*>[\s\S]*?<AdminDataTable>/);
  });

  it("reloads full detail after writes before rendering audit history", () => {
    const path = fileURLToPath(new URL("./learning-paths-client.tsx", import.meta.url));
    const source = readFileSync(path, "utf8");
    expect(source, "LEARNING_PATH_WRITE_RELOAD").toMatch(/const saved = \(await r\.json\(\)\) as \{ id: string \};[\s\S]{0,180}await openDetail\(saved\.id\)/);
  });

  it("reports detail refresh failures separately from a successful write", () => {
    const path = fileURLToPath(new URL("./learning-paths-client.tsx", import.meta.url));
    const source = readFileSync(path, "utf8");
    const detailLoader = source.match(/const openDetail = useCallback\(async \(id: string\) => \{[\s\S]*?\n {2}\}, \[t, toast\]\);/)?.[0] ?? "";
    expect(detailLoader).toMatch(/if \(!r\.ok\)[\s\S]*?toast\.error\(t\("errorLoad"\)\)/);
    expect(detailLoader).toMatch(/catch \{\s*toast\.error\(t\("errorLoad"\)\)/);
    expect(source).toMatch(/toast\.success\(t\("saved"\)\);[\s\S]{0,80}await load\(\);[\s\S]{0,40}await openDetail\(saved\.id\)/);
  });

  it("shows errors when a status or delete transition fails", () => {
    const path = fileURLToPath(new URL("./learning-paths-client.tsx", import.meta.url));
    const source = readFileSync(path, "utf8");
    const transition = source.match(/const submitTransition = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? "";
    expect(transition).toMatch(/if \(!r\.ok\)[\s\S]*?toast\.error\(t\("errorSave"\)\)/);
    expect(transition).toMatch(/catch \{\s*toast\.error\(t\("errorSave"\)\)/);
  });
});
