import { expect, test } from "@playwright/test";

test("member saves reject unfinished links and synchronize saved link and project fields", async ({ page }) => {
  await page.goto("/members/qingkong/edit");
  const save = page.getByRole("button", { name: "保存主页", exact: true });
  let writes = 0;
  page.on("request", (request) => {
    if (request.method() === "PATCH" && new URL(request.url()).pathname === "/api/members/qingkong") writes++;
  });

  await page.getByRole("button", { name: "添加一条链接" }).click();
  await save.click();
  await expect(page.locator('p[role="alert"]')).toContainText("链接名称和地址需要同时填写");
  expect(writes).toBe(0);
  await page.getByRole("textbox", { name: "地址", exact: true }).last().fill("");

  await page.getByRole("button", { name: /添加精选作品/ }).click();
  const project = page.locator("[data-editor-project]").last();
  await project.getByLabel("项目主地址", { exact: true }).fill("https://example.org/work");
  await project.getByLabel("项目名称", { exact: true }).fill("  Example work  ");
  await project.getByLabel("技术／主题标签", { exact: true }).fill(" TypeScript, TypeScript ");
  await project.getByRole("button", { name: "添加体验／文档等入口" }).click();
  await project.getByLabel("入口名称 1", { exact: true }).fill("Docs");
  await save.click();
  await expect(page.locator('p[role="alert"]')).toContainText("链接名称和地址需要同时填写");
  expect(writes).toBe(0);
  await project.getByLabel("入口名称 1", { exact: true }).fill("");

  const linksBefore = await page.getByRole("button", { name: "删除这条链接" }).count();
  await save.click();
  await expect(page.getByRole("status")).toContainText("已保存。");
  expect(writes).toBe(1);
  await expect(page.getByRole("button", { name: "删除这条链接" })).toHaveCount(linksBefore - 1);
  await expect(project.getByLabel("项目名称", { exact: true })).toHaveValue("Example work");
  await expect(project.getByLabel("技术／主题标签", { exact: true })).toHaveValue("TypeScript");
  await expect(project.getByRole("button", { name: "移除入口", exact: true })).toHaveCount(0);
});
