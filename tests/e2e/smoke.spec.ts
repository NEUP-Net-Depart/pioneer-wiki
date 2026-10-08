import { expect, test } from "@playwright/test";

test.describe("public Chromium smoke tests", () => {
  test("search renders a result page", async ({ page }) => {
    await page.goto("/search?q=tree");
    await expect(page.locator("main#content h1")).toContainText("检索");
    await expect(page.locator("main#content")).toContainText("B 树");
  });

  test("member page renders without browser errors", async ({ page }) => {
    await page.goto("/members/qingkong");
    await expect(page.locator("main#content h1")).toContainText("青空");
    await expect(page.locator("main#content")).toContainText("Qingkong");
  });

  test("entry page renders its bilingual heading", async ({ page }) => {
    await page.goto("/entries/b-tree");
    await expect(page.locator("main#content h1")).toContainText("B 树");
    await expect(page.locator("main#content h1")).toContainText("B-tree");
  });
});
