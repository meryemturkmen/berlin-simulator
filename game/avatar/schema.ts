import { z } from "zod";

export const BUILDS = ["slim", "medium", "strong"] as const;
export const HAIR_STYLES = [
  "short",
  "bob",
  "long",
  "bun",
  "ponytail",
  "curly",
  "buzz",
  "bald",
] as const;
export const TOPS = ["tshirt", "hoodie", "jacket", "tank"] as const;
export const BOTTOMS = ["jeans", "shorts", "skirt"] as const;
export const SHOES = ["sneakers", "boots"] as const;

export const SKIN_TONES = ["#f6d7c3", "#eac0a2", "#d9a37c", "#b97f57", "#8f5a3c", "#5e3a28"];
export const HAIR_COLORS = [
  "#1d1a1c",
  "#4a3024",
  "#7a4b2a",
  "#c98f4e",
  "#e8d08a",
  "#b5412f",
  "#9aa0a8",
  "#e77fa8",
  "#4f8fd1",
];
export const CLOTHING_COLORS = [
  "#f4efe6",
  "#23212b",
  "#e4604a",
  "#f3b95f",
  "#5d8a5a",
  "#3f6fb0",
  "#8a6fc4",
  "#e59ab4",
  "#7a8590",
  "#2f5d62",
];
export const SHOE_COLORS = ["#f4efe6", "#23212b", "#8b5a3c", "#e4604a", "#3f6fb0", "#5d8a5a"];

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const avatarSchema = z.object({
  name: z.string().trim().min(1).max(20),
  build: z.enum(BUILDS),
  skin: hexColor,
  hairStyle: z.enum(HAIR_STYLES),
  hairColor: hexColor,
  top: z.enum(TOPS),
  topColor: hexColor,
  bottom: z.enum(BOTTOMS),
  bottomColor: hexColor,
  shoes: z.enum(SHOES),
  shoeColor: hexColor,
});

export type AvatarConfig = z.infer<typeof avatarSchema>;
export type AvatarLook = Omit<AvatarConfig, "name">;

export const DEFAULT_AVATAR: AvatarConfig = {
  name: "",
  build: "medium",
  skin: SKIN_TONES[2],
  hairStyle: "bob",
  hairColor: HAIR_COLORS[1],
  top: "hoodie",
  topColor: CLOTHING_COLORS[2],
  bottom: "jeans",
  bottomColor: CLOTHING_COLORS[5],
  shoes: "sneakers",
  shoeColor: SHOE_COLORS[0],
};

function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length) % items.length];
}

/** Returns a random look. Pass a seeded generator for deterministic results. */
export function randomLook(random: () => number = Math.random): AvatarLook {
  return {
    build: pick(BUILDS, random),
    skin: pick(SKIN_TONES, random),
    hairStyle: pick(HAIR_STYLES, random),
    hairColor: pick(HAIR_COLORS, random),
    top: pick(TOPS, random),
    topColor: pick(CLOTHING_COLORS, random),
    bottom: pick(BOTTOMS, random),
    bottomColor: pick(CLOTHING_COLORS, random),
    shoes: pick(SHOES, random),
    shoeColor: pick(SHOE_COLORS, random),
  };
}

/** Small deterministic PRNG (mulberry32) for reproducible crowds and tests. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
