import { expect, test } from "@playwright/test";
import { createAvatarAndPlay, walkForward } from "./helpers";

test("title page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Berlin Simulator" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Spielen" })).toBeVisible();
});

test("language toggle switches the UI to English", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "en" }).click();
  await expect(page.getByRole("link", { name: "Play" })).toBeVisible();
});

test("avatar editor requires a name and saves the avatar", async ({ page }) => {
  await page.goto("/avatar");
  await expect(page.getByTestId("avatar-preview").locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: /Los geht's/ }).click();
  await expect(page).toHaveURL(/\/avatar$/);
  await expect(page.getByLabel("Name")).toBeFocused();

  await page.getByLabel("Name").fill("Mer");
  await page.getByText("Kräftig").click();
  await page.getByText("Locken").click();
  await page.getByText("Rock", { exact: true }).click();
  await page.getByRole("button", { name: /Los geht's/ }).click();
  await expect(page).toHaveURL(/\/play$/);

  const saved = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("berlin-sim:v1:avatar") ?? "null"),
  );
  expect(saved).toMatchObject({
    name: "Mer",
    build: "strong",
    hairStyle: "curly",
    bottom: "skirt",
  });
});

test("visiting /play without an avatar redirects to the editor", async ({ page }) => {
  await page.goto("/play");
  await expect(page).toHaveURL(/\/avatar$/);
});

test("player can create an avatar and walk", async ({ page }) => {
  await createAvatarAndPlay(page);
  expect(await walkForward(page, 1.5)).toBeGreaterThan(1.5);
});

test("about page explains the project and renders the architecture diagram", async ({ page }) => {
  await page.goto("/about");
  await expect(page.getByRole("heading", { name: "Berlin Simulator" })).toBeVisible();
  await expect(page.getByText("© OpenStreetMap-Mitwirkende, ODbL")).toBeVisible();
  await expect(page.getByRole("link", { name: "Quellcode auf GitHub" })).toHaveAttribute(
    "href",
    "https://github.com/meryemturkmen/berlin-simulator",
  );
  await expect(page.getByTestId("architecture-diagram").locator("svg")).toBeVisible();
});
