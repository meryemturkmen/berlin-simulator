import { expect, test } from "@playwright/test";

test("title page loads and links to the game", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Berlin Simulator" })).toBeVisible();
  await page.getByRole("link", { name: "Spielen" }).click();
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.locator("canvas")).toBeVisible();
});
