import { expect, test } from "@playwright/test";
import { seedAvatar, snapshot, waitForGame } from "./helpers";

test.beforeEach(async ({ page }) => {
  await seedAvatar(page);
});

// The brief asks for under five seconds locally; shared CI runners render in software.
const LOAD_BUDGET_MS = process.env.CI ? 30_000 : 5000;

test("Görlitzer Park loads within five seconds", async ({ page }) => {
  await page.goto("/play");
  const started = Date.now();
  await waitForGame(page);
  expect(Date.now() - started).toBeLessThan(LOAD_BUDGET_MS);
  expect((await snapshot(page)).place).toBe("goerli");
  await expect(page.getByTestId("place-name")).toHaveText("Görlitzer Park");
  await expect(page.getByTestId("loading-screen")).toHaveCSS("opacity", "0");
});

test("player can sit on a bench and stand up again", async ({ page }) => {
  await page.goto("/play");
  await waitForGame(page);
  // Stand right in front of a bench on the park's main path.
  await page.evaluate(() =>
    window.__berlinDebug!.teleport(
      -31.23 + Math.sin(2.63) * 1.1,
      -23.83 + Math.cos(2.63) * 1.1,
      2.63,
    ),
  );
  const prompt = page.getByTestId("interact-prompt");
  await expect(prompt).toContainText("Hinsetzen");
  await prompt.click();
  await expect(prompt).toContainText("Aufstehen");
  const seated = await snapshot(page);
  expect(Math.hypot(seated.player.x + 31.23, seated.player.z + 23.83)).toBeLessThan(0.3);

  await prompt.click();
  await expect(prompt).toContainText("Hinsetzen");
});

test("the day turns into night", async ({ page }) => {
  await page.goto("/play?hour=20.4");
  await waitForGame(page);
  const before = (await snapshot(page)).hour;
  await page.waitForTimeout(1500);
  expect((await snapshot(page)).hour).toBeGreaterThan(before);
});
