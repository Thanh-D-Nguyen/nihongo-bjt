import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

describe("Competencies mobile table", () => {
  it("contains the wide table in its own horizontal scroller", () => {
    const path = fileURLToPath(new URL("./competencies-client.tsx", import.meta.url));
    const source = ts.createSourceFile(
      path,
      readFileSync(path, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );
    let table: ts.JsxElement | undefined;
    const findTable = (node: ts.Node) => {
      if (ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === "AdminDataTable")
        table = node;
      ts.forEachChild(node, findTable);
    };
    findTable(source);

    let hasScrollRegion = false;
    for (let parent = table?.parent; parent; parent = parent.parent) {
      if (!ts.isJsxElement(parent) || parent.openingElement.tagName.getText(source) !== "div")
        continue;
      const className = parent.openingElement.attributes.properties.find(
        (attribute): attribute is ts.JsxAttribute =>
          ts.isJsxAttribute(attribute) && attribute.name.getText(source) === "className"
      )?.initializer;
      if (
        className &&
        ts.isStringLiteral(className) &&
        className.text.includes("overflow-x-auto")
      ) {
        hasScrollRegion = true;
        break;
      }
    }

    expect(table).toBeDefined();
    expect(hasScrollRegion).toBe(true);
  });
});
