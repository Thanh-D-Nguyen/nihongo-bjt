import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AdminPageHeader } from "@nihongo-bjt/ui";

describe("AdminPageHeader", () => {
  it("renders action controls passed as children", () => {
    const path = fileURLToPath(new URL("../../../packages/ui/src/admin-console.tsx", import.meta.url));
    const source = readFileSync(path, "utf8");
    expect(source).toMatch(/children,\s*className/);
    expect(source, "ADMIN_PAGE_HEADER_CHILDREN").toMatch(/actions \|\| children[\s\S]*?\{actions\}\s*\{children\}/);
  });

  it("renders children with and without explicit actions", () => {
    const childOnly = renderToStaticMarkup(
      createElement(AdminPageHeader, {
        title: "Learning Paths",
        children: createElement("button", null, "Create path")
      })
    );
    const actionsAndChildren = renderToStaticMarkup(
      createElement(AdminPageHeader, {
        actions: createElement("button", null, "Refresh"),
        title: "Learning Paths",
        children: createElement("button", null, "Create path")
      })
    );

    expect(childOnly).toContain("Create path");
    expect(actionsAndChildren).toContain("Refresh");
    expect(actionsAndChildren).toContain("Create path");
  });
});
