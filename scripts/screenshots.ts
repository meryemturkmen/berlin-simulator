/**
 * Captures the documentation screenshots in docs/screenshots.
 * Needs a running app: `pnpm build && pnpm start`, then `pnpm screenshots`.
 * Set BASE_URL to point somewhere else (default http://localhost:3000).
 */
import { chromium, type Page } from "@playwright/test";
import { join } from "node:path";
import { ROOT, ensureDir, log, runMain } from "./lib/io";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = ensureDir(join(ROOT, "docs", "screenshots"));

const AVATAR = {
  name: "Mer",
  build: "medium",
  skin: "#d9a37c",
  hairStyle: "bob",
  hairColor: "#4a3024",
  top: "hoodie",
  topColor: "#e4604a",
  bottom: "jeans",
  bottomColor: "#3f6fb0",
  shoes: "sneakers",
  shoeColor: "#f4efe6",
};

interface Shot {
  name: string;
  path: string;
  /** Runs in the page once the game (or page) is ready. */
  stage?: (page: Page) => Promise<void>;
  game?: boolean;
}

const debug = (page: Page, code: string) => page.evaluate(code);

const SHOTS: Shot[] = [
  { name: "title", path: "/" },
  { name: "avatar-editor", path: "/avatar" },
  {
    name: "goerli-day",
    path: "/play?hour=15",
    game: true,
    stage: async (page) => {
      await debug(page, "__berlinDebug.setHour(15, 0); __berlinDebug.teleport(-36, -12, 1.25)");
      await page.waitForTimeout(600);
      await debug(page, "__berlinDebug.setCamera(1.25 + Math.PI - 0.5, 0.2, 6)");
    },
  },
  {
    name: "goerli-sunset",
    path: "/play?hour=19.8",
    game: true,
    stage: async (page) => {
      await debug(
        page,
        "__berlinDebug.setHour(19.8, 0); __berlinDebug.teleport(-31.23 + Math.sin(2.63) * 1.1, -23.83 + Math.cos(2.63) * 1.1, 2.63)",
      );
      await page.waitForTimeout(1200);
      await page.keyboard.press("e");
      await page.waitForTimeout(1200);
      await debug(page, "__berlinDebug.setCamera(2.63 + 0.5, 0.12, 5)");
    },
  },
  {
    name: "goerli-night",
    path: "/play?hour=22.5",
    game: true,
    stage: async (page) => {
      await debug(page, "__berlinDebug.setHour(22.5, 0); __berlinDebug.teleport(-58, -36, 2.2)");
      await page.waitForTimeout(600);
      await debug(page, "__berlinDebug.setCamera(2.2 + Math.PI + 0.4, 0.16, 6)");
    },
  },
];

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900, mobile: false },
  { name: "mobile", width: 390, height: 844, mobile: true },
];

runMain(import.meta.url, async () => {
  const only = process.argv.slice(2).filter((argument) => !argument.startsWith("--"));
  const browser = await chromium.launch({
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      hasTouch: viewport.mobile,
      isMobile: viewport.mobile,
      deviceScaleFactor: viewport.mobile ? 2 : 1,
      locale: "de-DE",
    });
    await context.addInitScript(
      ([avatar]) => {
        window.localStorage.setItem("berlin-sim:v1:avatar", avatar);
        // Full quality for stills, even on a software renderer.
        window.localStorage.setItem(
          "berlin-sim:v1:settings",
          JSON.stringify({ language: "de", quality: "high", muted: true }),
        );
      },
      [JSON.stringify(AVATAR)],
    );
    for (const shot of SHOTS) {
      if (only.length > 0 && !only.some((name) => shot.name.includes(name))) continue;
      const page = await context.newPage();
      await page.goto(BASE_URL + shot.path);
      if (shot.game) {
        await page.waitForFunction(() => window.__berlin?.().ready === true, null, {
          timeout: 120_000,
        });
      } else {
        await page.waitForLoadState("networkidle");
      }
      await page.waitForTimeout(1500);
      await shot.stage?.(page);
      await page.waitForTimeout(3500);
      const file = join(OUT, `${shot.name}-${viewport.name}.jpg`);
      await page.screenshot({ path: file, type: "jpeg", quality: 86 });
      log("shot", `${shot.name}-${viewport.name}.jpg`);
      await page.close();
    }
    await context.close();
  }
  await browser.close();
});
