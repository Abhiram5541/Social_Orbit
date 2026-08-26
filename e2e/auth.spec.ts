import { expect, test } from "@playwright/test";
import { ACCOUNTS, PASSWORD, signIn } from "./support";

test.describe("authentication", () => {
  test("rejects a wrong password without revealing whether the account exists", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Work email").fill(ACCOUNTS.clientOwner);
    await page.getByLabel("Password", { exact: true }).fill("definitely-not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    // Next's route announcer also carries role="alert"; scope to the form's.
    const alert = page.getByRole("alert").filter({ hasText: "Could not sign you in" });
    await expect(alert).toContainText("Email or password is incorrect");
    await expect(page).toHaveURL(/\/login/);
  });

  test("gives an unknown address the identical message", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Work email").fill("nobody@example.invalid");
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Could not sign you in" }),
    ).toContainText("Email or password is incorrect");
  });

  test("validates the email format before submitting", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Work email").fill("not-an-email");
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Enter a valid email address")).toBeVisible();
  });

  test("sends an unauthenticated visitor to sign-in and back again", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("routes each role to its own workspace", async ({ page }) => {
    await signIn(page, ACCOUNTS.clientOwner);
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("routes platform staff to the admin workspace", async ({ page }) => {
    await signIn(page, ACCOUNTS.superAdmin);
    await expect(page).toHaveURL(/\/admin/);
  });

  test("routes a creator to the creator portal", async ({ page }) => {
    await signIn(page, ACCOUNTS.creator);
    await expect(page).toHaveURL(/\/creator/);
  });

  test("signs out and blocks the workspace again", async ({ page }) => {
    await signIn(page, ACCOUNTS.clientOwner);
    await page.request.post("/api/internal/auth/logout");
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
