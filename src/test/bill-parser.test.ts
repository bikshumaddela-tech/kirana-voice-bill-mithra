import { describe, expect, it } from "vitest";
import { billTotal, parseBillText } from "@/lib/bill-parser";

describe("bill parser", () => {
  it("parses the English sample into three items with total 315", () => {
    const items = parseBillText("2 kg Rice 120 rupees, 1 liter Sunflower Oil 150 rupees, 1 kg Sugar 45 rupees");
    expect(items.map((i) => [i.name, i.quantity, i.unit, i.price])).toEqual([
      ["Rice", 2, "kg", 120],
      ["Sunflower Oil", 1, "L", 150],
      ["Sugar", 1, "kg", 45],
    ]);
    expect(billTotal(items)).toBe(315);
  });
  it("parses Telugu units and rupees", () => {
    const items = parseBillText("2 కిలో బియ్యం 120 రూపాయలు, 1 లీటర్ నూనె 150 రూపాయలు");
    expect(items.map((i) => [i.name, i.quantity, i.unit, i.price])).toEqual([
      ["బియ్యం", 2, "kg", 120],
      ["నూనె", 1, "L", 150],
    ]);
  });
});
