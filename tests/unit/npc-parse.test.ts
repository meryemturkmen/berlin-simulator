import { describe, expect, it } from "vitest";
import { getNpc } from "@/content/npcs";
import { extractPartialReply, parseNpcReply } from "@/lib/npc/parse";

const micha = getNpc("micha")!;

describe("extractPartialReply", () => {
  it("returns the text decoded so far while JSON streams in", () => {
    const full = '{"reply": "Na klar, mach ruhig.", "emotion": "happy", "action": "pet_dog"}';
    let previous = "";
    for (let length = 0; length <= full.length; length++) {
      const partial = extractPartialReply(full.slice(0, length));
      // Text only ever grows: nothing shown to the player is taken back.
      expect(partial.startsWith(previous)).toBe(true);
      previous = partial;
    }
    expect(previous).toBe("Na klar, mach ruhig.");
  });

  it("decodes escapes and holds back incomplete ones", () => {
    expect(extractPartialReply('{"reply":"Er sagt \\"Tach\\" und\\ngeht')).toBe(
      'Er sagt "Tach" und\ngeht',
    );
    expect(extractPartialReply('{"reply":"Sch\\u00f6n')).toBe("Schön");
    expect(extractPartialReply('{"reply":"Sch\\u00')).toBe("Sch");
    expect(extractPartialReply('{"reply":"Ende\\')).toBe("Ende");
  });

  it("returns nothing before the reply field starts", () => {
    expect(extractPartialReply("")).toBe("");
    expect(extractPartialReply('{"emotion":"happy"')).toBe("");
    expect(extractPartialReply('```json\n{"rep')).toBe("");
  });
});

describe("parseNpcReply", () => {
  it("accepts a well-formed answer", () => {
    expect(
      parseNpcReply('{"reply":"Tach ooch!","emotion":"happy","action":"wave"}', micha, "de"),
    ).toEqual({
      reply: "Tach ooch!",
      emotion: "happy",
      action: "wave",
    });
  });

  it("tolerates code fences and surrounding text", () => {
    const raw =
      'Here you go:\n```json\n{"reply":"Hello there!","emotion":"neutral","action":null}\n```';
    expect(parseNpcReply(raw, micha, "en").reply).toBe("Hello there!");
  });

  it("drops actions the NPC does not have and unknown emotions", () => {
    const result = parseNpcReply(
      '{"reply":"Hier, dein Matcha.","emotion":"ecstatic","action":"serve_matcha"}',
      micha,
      "de",
    );
    expect(result).toEqual({ reply: "Hier, dein Matcha.", emotion: "neutral", action: null });
  });

  it("recovers the reply text from truncated JSON", () => {
    const result = parseNpcReply('{"reply":"Dit is Bolle, der freut sich.","emo', micha, "de");
    expect(result).toEqual({
      reply: "Dit is Bolle, der freut sich.",
      emotion: "neutral",
      action: null,
    });
  });

  it("falls back to an in-character line when nothing is usable", () => {
    expect(parseNpcReply("I cannot answer that.", micha, "en").reply).toMatch(/distracted/);
    expect(parseNpcReply("", micha, "de").reply).toMatch(/abgelenkt/);
    expect(parseNpcReply('{"reply":""}', micha, "de").reply).toMatch(/abgelenkt/);
  });

  it("shortens rambling replies to four sentences", () => {
    const raw = JSON.stringify({ reply: "A. B. C. D. E. F.", emotion: "neutral", action: null });
    expect(parseNpcReply(raw, micha, "en").reply).toBe("A. B. C. D.");
  });
});
