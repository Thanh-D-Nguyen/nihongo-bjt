import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const couponSeed = () => {
  const path = resolve("database/scripts/seeds/radar/seed-daily-radar.ts");
  const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
  let coupon: ts.ObjectLiteralExpression | undefined;

  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "cards" &&
      node.initializer &&
      ts.isArrayLiteralExpression(node.initializer)
    ) {
      coupon = node.initializer.elements.find(
        (element): element is ts.ObjectLiteralExpression =>
          ts.isObjectLiteralExpression(element) &&
          element.properties.some(
            (property) =>
              ts.isPropertyAssignment(property) &&
              property.name.getText(source) === "slug" &&
              ts.isStringLiteral(property.initializer) &&
              property.initializer.text === "coupon-terms"
          )
      );
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  const property = (object: ts.ObjectLiteralExpression | undefined, name: string) =>
    object?.properties.find(
      (item) => ts.isPropertyAssignment(item) && item.name.getText(source) === name
    );
  const stringValue = (name: string) => {
    const item = property(coupon, name);
    return item && ts.isPropertyAssignment(item) && ts.isStringLiteral(item.initializer)
      ? item.initializer.text
      : undefined;
  };
  const metadata = property(coupon, "metadata");
  const metadataCall = metadata && ts.isPropertyAssignment(metadata) && ts.isCallExpression(metadata.initializer)
    ? metadata.initializer
    : undefined;
  const partial = metadataCall?.arguments[0];
  const expressionProperty = partial && ts.isObjectLiteralExpression(partial)
    ? property(partial, "japaneseExpressions")
    : undefined;
  const expressionArray = expressionProperty && ts.isPropertyAssignment(expressionProperty) && ts.isArrayLiteralExpression(expressionProperty.initializer)
    ? expressionProperty.initializer
    : undefined;
  const expressions = expressionArray?.elements.map((item) => {
    if (!ts.isObjectLiteralExpression(item)) return undefined;
    return Object.fromEntries(
      item.properties.flatMap((entry) => {
        if (!ts.isPropertyAssignment(entry) || !ts.isStringLiteral(entry.initializer)) return [];
        return [[entry.name.getText(source), entry.initializer.text]];
      })
    );
  }) ?? [];

  return { stringValue, expressions };
};

describe("Daily Radar seed localization", () => {
  it("stores the coupon card title in the matching Vietnamese and Japanese fields", () => {
    const { stringValue } = couponSeed();
    expect(stringValue("titleVi")).toBe("Đọc điều kiện coupon / khuyến mãi");
    expect(stringValue("titleJa")).toBe("クーポンの条件を読む");
  });

  it("provides structured expressions consumed by the card detail screen", () => {
    expect(couponSeed().expressions).toEqual([
      {
        word: "対象商品",
        reading: "たいしょうしょうひん",
        meaning: "Sản phẩm áp dụng",
        example: "対象商品のみご利用いただけます。",
        jlptLevel: "N3",
        usageNote: "Không phải mọi sản phẩm đều dùng được coupon."
      },
      {
        word: "併用不可",
        reading: "へいようふか",
        meaning: "Không dùng chung được",
        example: "他のクーポンとの併用不可です。",
        jlptLevel: "N2",
        usageNote: "Không thể áp dụng cùng coupon khác."
      },
      {
        word: "期間限定",
        reading: "きかんげんてい",
        meaning: "Chỉ trong thời gian nhất định",
        example: "期間限定：6月1日〜6月30日まで。",
        jlptLevel: "N3",
        usageNote: "Thời hạn áp dụng có giới hạn."
      },
      {
        word: "税込",
        reading: "ぜいこみ",
        meaning: "Đã bao gồm thuế",
        example: "表示価格は税込です。",
        jlptLevel: "N3",
        usageNote: "Ngược với 税抜, giá chưa gồm thuế."
      },
      {
        word: "一人一回限り",
        reading: "ひとりいっかいかぎり",
        meaning: "Mỗi người chỉ được một lần",
        example: "お一人様一回限りのご利用となります。",
        jlptLevel: "N3",
        usageNote: "Giới hạn số lần sử dụng coupon."
      }
    ]);
  });
});
