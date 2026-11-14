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
  expect(Math.hypot(seated.player.x + 31.23, seated.player.z + 23.83)).toBeLessThan(0.6);

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

test("the map travels to every place", async ({ page }) => {
  await page.goto("/play");
  await waitForGame(page);
  for (const [id, name] of [
    ["mitte", "Hackescher Markt"],
    ["kudamm", "Kurfürstendamm"],
    ["goerli", "Görlitzer Park"],
  ]) {
    await page.keyboard.press("m");
    const map = page.getByTestId("map");
    await expect(map).toBeVisible();
    await map.getByTestId(`map-place-${id}`).click();
    // Loading screen with a fact about the destination, then the new scene.
    await expect(page.getByTestId("loading-screen")).toHaveAttribute("aria-hidden", "false");
    await expect(page.getByTestId("loading-screen")).toContainText(name);
    await expect.poll(async () => (await snapshot(page)).place, { timeout: 60_000 }).toBe(id);
    await expect(page.getByTestId("place-name")).toHaveText(name, { timeout: 60_000 });
    await waitForGame(page);
  }
});

test("the map opens from the button and closes with Escape", async ({ page }) => {
  await page.goto("/play");
  await waitForGame(page);
  await page.getByTestId("open-map").click();
  await expect(page.getByTestId("map")).toBeVisible();
  await expect(page.getByTestId("map-place-goerli")).toContainText("Du bist hier");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("map")).toBeHidden();
});

test("ordering a matcha in Mitte fills the inventory and unlocks an experience", async ({
  page,
}) => {
  await page.goto("/play?place=mitte");
  await waitForGame(page);
  await page.evaluate(() => window.__berlinDebug!.teleport(13.2, 8.6, 3.4));
  await expect(page.getByTestId("interact-prompt")).toContainText("Noor");
  await page.getByTestId("interact-prompt").click();
  const chat = page.getByTestId("chat");
  await chat.getByRole("button", { name: "Einen Matcha Latte, bitte!" }).click();
  await expect(chat.getByTestId("chat-npc-line").last()).toContainText("Hafermilch", {
    timeout: 30_000,
  });
  await expect(page.getByTestId("experience-toast")).toContainText("Matcha in Mitte");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("inventory")).toContainText("Matcha Latte");
});

test("a deep link opens the requested place", async ({ page }) => {
  await page.goto("/play?place=kudamm");
  await waitForGame(page);
  expect((await snapshot(page)).place).toBe("kudamm");
});
