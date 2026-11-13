import { expect, type Page } from "@playwright/test";
import type { DebugSnapshot } from "@/game/runtime";

export function snapshot(page: Page): Promise<DebugSnapshot> {
  return page.evaluate(() => window.__berlin!());
}

const TEST_AVATAR = {
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

/** Stores an avatar before the app starts, so tests can open /play directly. */
export async function seedAvatar(page: Page) {
  await page.addInitScript((avatar) => {
    window.localStorage.setItem("berlin-sim:v1:avatar", avatar);
  }, JSON.stringify(TEST_AVATAR));
}

/** Goes through the title screen and avatar editor and waits for the game to run. */
export async function createAvatarAndPlay(page: Page, name = "Mer") {
  await page.goto("/");
  await page.getByRole("link", { name: /Spielen|Play/ }).click();
  await expect(page).toHaveURL(/\/avatar$/);
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: /Los geht's|Let's go/ }).click();
  await expect(page).toHaveURL(/\/play$/);
  await waitForGame(page);
}

export async function waitForGame(page: Page) {
  await page.waitForFunction(() => window.__berlin?.().ready === true, null, { timeout: 60_000 });
}

export function isMobile(page: Page): boolean {
  return (page.viewportSize()?.width ?? 1440) < 600;
}

/**
 * Holds "forward" (keyboard or touch joystick) until the player has covered
 * `meters`. Polls instead of sleeping so slow software-rendered CI runs pass.
 */
export async function walkForward(page: Page, meters = 1.5): Promise<number> {
  const start = (await snapshot(page)).player;
  const moved = async () => {
    const now = (await snapshot(page)).player;
    return Math.hypot(now.x - start.x, now.z - start.z);
  };
  const mobile = isMobile(page);
  if (mobile) {
    const box = (await page.getByTestId("joystick").boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx, cy - 40, { steps: 4 });
  } else {
    await page.keyboard.down("KeyW");
  }
  try {
    await expect.poll(moved, { timeout: 30_000, intervals: [200] }).toBeGreaterThan(meters);
  } finally {
    if (mobile) await page.mouse.up();
    else await page.keyboard.up("KeyW");
  }
  return moved();
}
