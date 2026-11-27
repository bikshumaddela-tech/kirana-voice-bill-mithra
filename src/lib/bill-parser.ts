export interface BillItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  price: number;
}

const UNIT_MAP: Record<string, string> = {
  kg: "kg", kgs: "kg", kilo: "kg", kilos: "kg", kilogram: "kg", kilograms: "kg", "కిలో": "kg", "కిలోలు": "kg", "కేజీ": "kg",
  g: "g", gm: "g", gms: "g", gram: "g", grams: "g", "గ్రాములు": "g", "గ్రాము": "g",
  l: "L", ltr: "L", litre: "L", liter: "L", litres: "L", liters: "L", "లీటర్": "L", "లీటరు": "L", "లీటర్లు": "L",
  ml: "ml",
  packet: "pkt", packets: "pkt", pkt: "pkt", "ప్యాకెట్": "pkt", "ప్యాకెట్లు": "pkt",
  piece: "pc", pieces: "pc", pcs: "pc", pc: "pc", dozen: "dozen", "డజను": "dozen",
};

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, half: 0.5,
  "ఒక": 1, "ఒకటి": 1, "రెండు": 2, "మూడు": 3, "నాలుగు": 4, "ఐదు": 5, "అర": 0.5,
};

const PRICE_WORDS = /(rupees|rupee|rs\.?|₹|రూపాయలు|రూపాయి|రూ\.?)/giu;

let counter = 0;
const newId = () => `i${Date.now().toString(36)}${(counter++).toString(36)}`;

/** Parse one spoken segment like "2 kg Rice 120 rupees". Returns null when no item name is found. */
export function parseSegment(segment: string): Omit<BillItem, "id"> | null {
  let text = segment.replace(PRICE_WORDS, " ₹ ").replace(/\s+/g, " ").trim();
  if (!text) return null;
  const tokens = text.split(" ");
  let quantity: number | null = null;
  let unit = "";
  let price: number | null = null;
  const nameParts: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const raw = tokens[i] ?? "";
    const tok = raw.toLowerCase();
    if (tok === "₹") continue;
    const glued = tok.match(/^(\d+(?:\.\d+)?)([a-z\u0C00-\u0C7F]+)$/u);
    const num = glued ? Number(glued[1]) : /^\d+(?:\.\d+)?$/.test(tok) ? Number(tok) : NUMBER_WORDS[tok];
    if (num !== undefined && !Number.isNaN(num)) {
      const unitTok = glued ? (glued[2] ?? "") : (tokens[i + 1] ?? "").toLowerCase();
      const nextIsRupee = tokens[i + 1] === "₹" || tokens[i - 1] === "₹";
      if (!nextIsRupee && UNIT_MAP[unitTok] && quantity === null) {
        quantity = num;
        unit = UNIT_MAP[unitTok] ?? "";
        if (!glued) i++;
      } else if (nextIsRupee || (quantity !== null && price === null) || (nameParts.length > 0 && price === null)) {
        if (price === null) price = num;
      } else if (quantity === null) {
        quantity = num;
      } else if (price === null) {
        price = num;
      }
      continue;
    }
    if (UNIT_MAP[tok] && quantity === null) {
      quantity = 1;
      unit = UNIT_MAP[tok] ?? "";
      continue;
    }
    nameParts.push(raw);
  }
  const name = nameParts.join(" ").trim();
  if (!name) return null;
  return { name: name.charAt(0).toUpperCase() + name.slice(1), quantity: quantity ?? 1, unit, price: price ?? 0 };
}

/** Split spoken text on commas, "and", "మరియు" and parse each item. */
export function parseBillText(text: string): BillItem[] {
  return text
    .split(/,|;|\n|\band\b|మరియు|\bthen\b/giu)
    .map((s) => parseSegment(s))
    .filter((x): x is Omit<BillItem, "id"> => x !== null)
    .map((x) => ({ ...x, id: newId() }));
}

/** Spoken price is the line amount, not per-unit. */
export function billTotal(items: BillItem[]): number {
  return items.reduce((sum, it) => sum + (Number.isFinite(it.price) ? it.price : 0), 0);
}
