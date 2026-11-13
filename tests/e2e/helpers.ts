import { expect, type Page } from "@playwright/test";
import type { DebugSnapshot } from "@/game/runtime";

export function snapshot(page: Page): Promise<DebugSnapshot> {
  return page.evaluate(() => window.__berlin!());
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

/** Walks forward for a moment using the keyboard or the touch joystick. */
export async function walkForward(page: Page, milliseconds = 1200) {
  if (isMobile(page)) {
    const box = (await page.getByTestId("joystick").boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx, cy - 40, { steps: 4 });
    await page.waitForTimeout(milliseconds);
    await page.mouse.up();
  } else {
    await page.keyboard.down("KeyW");
    await page.waitForTimeout(milliseconds);
    await page.keyboard.up("KeyW");
  }
}
