import { test, expect, type Page } from "@playwright/test";

async function signUpAndReachMyPages(page: Page) {
  const email = `finder-e2e-${Date.now()}@example.test`;
  const password = "correct horse battery staple";

  await page.goto("/sign-up");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(/\/app/, { timeout: 10000 });

  await page.goto("/my-pages");
  await expect(page).toHaveURL(/\/my-pages/);
}

async function publishAPage(page: Page, title: string) {
  await page.goto("/app");
  // A fresh account starts with a sample draft already open — overwrite its
  // content directly rather than creating a new draft, sidestepping any
  // keyboard-shortcut timing race with the editor's initial mount.
  const editor = page.getByRole("textbox", { name: "Write or paste Markdown…" });
  await editor.waitFor({ state: "visible", timeout: 10000 });
  await editor.click();
  await editor.fill(`# ${title}\n\nContent for ${title}.`);
  await page.getByRole("button", { name: "Publish" }).click();
  await page.waitForTimeout(1000);
}

test.describe("Finder-style collections", () => {
  test("create a top-level folder, a sub-folder inside it, and navigate via breadcrumb", async ({ page }) => {
    await signUpAndReachMyPages(page);

    // The empty state has no sidebar/tree at all — need at least one page.
    await publishAPage(page, "Sample Page");
    await page.goto("/my-pages");

    const newFolderInput = page.getByPlaceholder("New folder…");
    await newFolderInput.fill("Work");
    await newFolderInput.press("Enter");
    await expect(page.getByRole("button", { name: /^Work/ })).toBeVisible();

    await page.getByRole("button", { name: /^Work/ }).click();
    await newFolderInput.fill("Q1");
    await newFolderInput.press("Enter");

    // Q1 renders as a folder row in the main pane, nested under Work.
    await expect(page.getByText("Q1", { exact: true })).toBeVisible();

    await page.getByText("Q1", { exact: true }).dblclick();
    // Breadcrumb now shows the full path; both segments should be present.
    const breadcrumb = page.locator("main");
    await expect(breadcrumb).toContainText("Work");
    await expect(breadcrumb).toContainText("Q1");
  });

  test("rename a top-level folder inline via Enter", async ({ page }) => {
    await signUpAndReachMyPages(page);
    await publishAPage(page, "Another Page");
    await page.goto("/my-pages");

    const newFolderInput = page.getByPlaceholder("New folder…");
    await newFolderInput.fill("Renameable");
    await newFolderInput.press("Enter");

    const folderButton = page.getByRole("button", { name: /^Renameable/ });
    await expect(folderButton).toBeVisible();
    await folderButton.click();
    await page.keyboard.press("Enter");

    // Selecting a folder then pressing Enter starts inline rename in place
    // (in the sidebar for a top-level folder); the freshly-focused input
    // is the rename box, pre-filled with the current name.
    const renameInput = page.locator("input:focus");
    await expect(renameInput).toHaveValue("Renameable");
    await renameInput.fill("Renamed Folder");
    await renameInput.press("Enter");

    await expect(page.getByRole("button", { name: /^Renamed Folder/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Renameable/ })).toHaveCount(0);
  });

  test("reject nesting a folder that has children", async ({ page }) => {
    await signUpAndReachMyPages(page);
    await publishAPage(page, "Yet Another Page");
    await page.goto("/my-pages");

    const newFolderInput = page.getByPlaceholder("New folder…");
    await newFolderInput.fill("Nestable");
    await newFolderInput.press("Enter");
    await page.getByRole("button", { name: /^Nestable/ }).click();
    await newFolderInput.fill("Child");
    await newFolderInput.press("Enter");
    await expect(page.getByText("Child", { exact: true })).toBeVisible();

    // "Nestable" now has a child — attempting to move it under another
    // top-level folder via the API directly (mirroring what the UI's
    // canNestInto guard prevents from ever being offered) must be rejected.
    await page.goto("/my-pages");
    await page.getByPlaceholder("New folder…").fill("Target");
    await page.getByPlaceholder("New folder…").press("Enter");

    const collectionsRes = await page.request.get("/api/collections");
    const { collections } = (await collectionsRes.json()) as {
      collections: Array<{ id: string; name: string }>;
    };
    const nestable = collections.find((c) => c.name === "Nestable");
    const target = collections.find((c) => c.name === "Target");
    expect(nestable).toBeTruthy();
    expect(target).toBeTruthy();

    const patchRes = await page.request.patch(`/api/collections/${nestable!.id}`, {
      data: { parent_id: target!.id },
    });
    expect(patchRes.status()).toBe(422);
    const body = (await patchRes.json()) as { error: string };
    expect(body.error).toContain("sub-folders");
  });
});
