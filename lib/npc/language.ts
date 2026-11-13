import type { Language } from "@/game/store/settings";

const GERMAN = new Set(
  "ich du der die das und ist nicht ein eine was wie wo warum hallo hi danke bitte ja nein mit für auf hier gibt es mir dir kannst hast bist möchte gerne einen auch noch schon mal sehr gut tschüss hey na wer wann dein mein heißt heiße".split(
    " ",
  ),
);
const ENGLISH = new Set(
  "i you the and is not a an what how where why hello thanks please yes no with for on here there me your can have are would like one also still very good bye who when my name do does it this that".split(
    " ",
  ),
);

/**
 * Guesses whether a message is German or English by counting common words.
 * Umlauts and ß count as strong German signals. Falls back to `hint`.
 */
export function detectLanguage(text: string, hint: Language): Language {
  const lower = text.toLowerCase();
  let german = /[äöüß]/.test(lower) ? 2 : 0;
  let english = 0;
  for (const word of lower.split(/[^a-zäöüß']+/)) {
    if (GERMAN.has(word)) german++;
    if (ENGLISH.has(word)) english++;
  }
  if (german === english) return hint;
  return german > english ? "de" : "en";
}
