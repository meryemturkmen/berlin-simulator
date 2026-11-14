import { expect, test } from "@playwright/test";
import { seedAvatar, snapshot, waitForGame } from "./helpers";

test.beforeEach(async ({ page }) => {
  await seedAvatar(page);
  await page.goto("/play");
  await waitForGame(page);
});

test("the album lists every experience and fills up as they are unlocked", async ({ page }) => {
  await page.getByTestId("open-album").click();
  const album = page.getByTestId("album");
  await expect(album.getByTestId("album-progress")).toContainText("0 von 12");
  await expect(album.locator("li[data-unlocked='true']")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(album).toBeHidden();

  // Sitting on a picnic blanket next to Tarek is not an experience, but his invitation is.
  await page.evaluate(() => window.__berlinDebug!.teleport(20.6, -20.4, 2.4));
  await page.getByTestId("interact-prompt").click();
  await page.getByTestId("chat").getByRole("button", { name: "Darf ich mich dazusetzen?" }).click();
  await expect(page.getByTestId("experience-toast")).toContainText("Zum Picknick eingeladen");
  await page.keyboard.press("Escape");

  await page.keyboard.press("b");
  await expect(album.getByTestId("album-progress")).toContainText("1 von 12");
  await expect(album.locator("li[data-unlocked='true']")).toContainText("Zum Picknick eingeladen");
});

test("watching the sunset from a bench unlocks an experience", async ({ page }) => {
  await page.evaluate(() => {
    window.__berlinDebug!.setHour(19.9, 0);
    window.__berlinDebug!.teleport(
      -31.23 + Math.sin(2.63) * 1.1,
      -23.83 + Math.cos(2.63) * 1.1,
      2.63,
    );
  });
  await page.getByTestId("interact-prompt").click();
  await expect(page.getByTestId("experience-toast")).toContainText("Sonnenuntergang im Görli", {
    timeout: 20_000,
  });
});

test("sound can be muted and the choice is remembered", async ({ page }) => {
  const toggle = page.getByTestId("toggle-sound");
  await expect(toggle).toHaveAccessibleName("Ton ausschalten");
  await toggle.click();
  await expect(toggle).toHaveAccessibleName("Ton einschalten");
  await page.reload();
  await waitForGame(page);
  await expect(page.getByTestId("toggle-sound")).toHaveAccessibleName("Ton einschalten");
});

test("graphics quality can be set by hand", async ({ page }) => {
  // Headless Chromium renders in software, which auto-detects as "low".
  expect((await snapshot(page)).quality).toBe("low");
  await page.getByTestId("open-settings").click();
  const settings = page.getByTestId("settings");
  await expect(settings).toContainText("Aktuell: Niedrig");
  await settings.getByRole("button", { name: "Mittel" }).click();
  await page.keyboard.press("Escape");
  await waitForGame(page);
  await expect.poll(async () => (await snapshot(page)).quality).toBe("medium");
});
