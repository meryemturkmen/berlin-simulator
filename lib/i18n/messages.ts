import type { Language } from "@/game/store/settings";

const de = {
  "title.tagline":
    "Ein gemütlicher Tag in der Stadt. Lauf los, quatsch mit den Leuten, sammle Momente.",
  "title.play": "Spielen",
  "title.editAvatar": "Avatar ändern",
  "title.about": "Über das Projekt",
  "common.language": "Sprache",
  "common.close": "Schließen",
  "common.back": "Zurück",

  "editor.heading": "Wer bist du heute?",
  "editor.name": "Name",
  "editor.namePlaceholder": "Dein Name",
  "editor.nameHint": "Den Namen sagen dir die Leute im Kiez.",
  "editor.build": "Körperbau",
  "editor.skin": "Hautton",
  "editor.hairStyle": "Frisur",
  "editor.hairColor": "Haarfarbe",
  "editor.top": "Oberteil",
  "editor.bottom": "Hose",
  "editor.shoes": "Schuhe",
  "editor.color": "Farbe",
  "editor.random": "Zufall",
  "editor.start": "Los geht's",
  "editor.rotateLeft": "Nach links drehen",
  "editor.rotateRight": "Nach rechts drehen",
  "editor.previewHint": "Ziehen zum Drehen",
  "editor.preview": "Vorschau deines Avatars",

  "build.slim": "Schlank",
  "build.medium": "Mittel",
  "build.strong": "Kräftig",
  "hair.short": "Kurz",
  "hair.bob": "Bob",
  "hair.long": "Lang",
  "hair.bun": "Dutt",
  "hair.ponytail": "Zopf",
  "hair.curly": "Locken",
  "hair.buzz": "Raspel",
  "hair.bald": "Glatze",
  "top.tshirt": "T-Shirt",
  "top.hoodie": "Hoodie",
  "top.jacket": "Jacke",
  "top.tank": "Top",
  "bottom.jeans": "Jeans",
  "bottom.shorts": "Shorts",
  "bottom.skirt": "Rock",
  "shoes.sneakers": "Sneaker",
  "shoes.boots": "Stiefel",

  "hud.controlsDesktop": "WASD oder Pfeiltasten: laufen · Shift: rennen · Maus ziehen: umsehen",
  "hud.controlsMobile": "Links: laufen · Rechts ziehen: umsehen",
  "hud.loading": "Lädt",
  "hud.arriving": "Unterwegs nach",
  "hud.didYouKnow": "Schon gewusst?",
  "interact.sit": "Hinsetzen",
  "interact.stand": "Aufstehen",
  "interact.talk": "Sprechen",
} as const;

export type MessageKey = keyof typeof de;

const en: Record<MessageKey, string> = {
  "title.tagline": "A cozy day in the city. Wander around, chat with the locals, collect moments.",
  "title.play": "Play",
  "title.editAvatar": "Change avatar",
  "title.about": "About this project",
  "common.language": "Language",
  "common.close": "Close",
  "common.back": "Back",

  "editor.heading": "Who are you today?",
  "editor.name": "Name",
  "editor.namePlaceholder": "Your name",
  "editor.nameHint": "This is what people in the neighborhood will call you.",
  "editor.build": "Build",
  "editor.skin": "Skin tone",
  "editor.hairStyle": "Hairstyle",
  "editor.hairColor": "Hair color",
  "editor.top": "Top",
  "editor.bottom": "Bottoms",
  "editor.shoes": "Shoes",
  "editor.color": "Color",
  "editor.random": "Randomize",
  "editor.start": "Let's go",
  "editor.rotateLeft": "Rotate left",
  "editor.rotateRight": "Rotate right",
  "editor.previewHint": "Drag to rotate",
  "editor.preview": "Preview of your avatar",

  "build.slim": "Slim",
  "build.medium": "Medium",
  "build.strong": "Strong",
  "hair.short": "Short",
  "hair.bob": "Bob",
  "hair.long": "Long",
  "hair.bun": "Bun",
  "hair.ponytail": "Ponytail",
  "hair.curly": "Curly",
  "hair.buzz": "Buzz cut",
  "hair.bald": "Bald",
  "top.tshirt": "T-shirt",
  "top.hoodie": "Hoodie",
  "top.jacket": "Jacket",
  "top.tank": "Tank top",
  "bottom.jeans": "Jeans",
  "bottom.shorts": "Shorts",
  "bottom.skirt": "Skirt",
  "shoes.sneakers": "Sneakers",
  "shoes.boots": "Boots",

  "hud.controlsDesktop": "WASD or arrow keys: walk · Shift: run · Drag mouse: look around",
  "hud.controlsMobile": "Left: walk · Drag right: look around",
  "hud.loading": "Loading",
  "hud.arriving": "On the way to",
  "hud.didYouKnow": "Did you know?",
  "interact.sit": "Sit down",
  "interact.stand": "Stand up",
  "interact.talk": "Talk",
};

export const messages: Record<Language, Record<MessageKey, string>> = { de, en };

/** Looks up a message and fills `{name}` style placeholders. */
export function translate(
  language: Language,
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  const template = messages[language][key] ?? messages.de[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
