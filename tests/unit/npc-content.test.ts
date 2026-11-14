import { describe, expect, it } from "vitest";
import { NPCS, getNpc } from "@/content/npcs";
import { PLACES, getPlace } from "@/content/places";
import { npcSchema } from "@/lib/npc/schema";

describe("NPC definitions", () => {
  it("has at least two NPCs for every place", () => {
    for (const place of PLACES) {
      expect(place.npcs.length, place.id).toBeGreaterThanOrEqual(2);
    }
  });

  it.each(NPCS)("$id is consistent with its place", (npc) => {
    const place = getPlace(npc.location);
    expect(place, `place ${npc.location}`).toBeDefined();
    expect(place!.npcs.some((spot) => spot.npc === npc.id)).toBe(true);

    const experiences = new Set(place!.experiences.map((experience) => experience.id));
    const seats = new Set(place!.seats.map((seat) => seat.id));
    for (const action of npc.availableActions) {
      if (action.experience)
        expect(experiences.has(action.experience), action.experience).toBe(true);
      if (action.seat) expect(seats.has(action.seat), action.seat).toBe(true);
    }
  });

  it("only places NPCs that exist", () => {
    for (const place of PLACES) {
      for (const spot of place.npcs) expect(getNpc(spot.npc), spot.npc).toBeDefined();
    }
  });

  it("rejects mock rules that use actions the NPC does not have", () => {
    const broken = structuredClone(getNpc("jule")!) as unknown as Record<string, never>;
    (
      broken as unknown as { mock: { de: { rules: { action: string }[] } } }
    ).mock.de.rules[0].action = "serve_matcha";
    expect(npcSchema.safeParse(broken).success).toBe(false);
  });

  it("rejects dialect strengths outside 0 to 3", () => {
    const broken = structuredClone(NPCS[0]);
    broken.speechStyle.dialect = 4;
    expect(npcSchema.safeParse(broken).success).toBe(false);
  });
});
