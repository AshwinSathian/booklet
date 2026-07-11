import * as vscode from "vscode";
import { createClient, ReadableApiError } from "readable-api-client";

export async function setApiKey(): Promise<void> {
  const key = await vscode.window.showInputBox({
    prompt: "Enter your Readable API key",
    password: true,
    placeHolder: "rdbl_...",
    ignoreFocusOut: true,
  });

  if (!key) return;

  const config = vscode.workspace.getConfiguration("readable");
  const baseUrl = config.get<string>("baseUrl") ?? "https://readable-api.ashwinsathian.com";

  // Validate the key. Network errors (status 0, see ReadableApiError) are
  // treated as valid — don't block saving a key just because the API was
  // briefly unreachable; only a real auth rejection should.
  let valid = true;
  try {
    await createClient({ baseUrl, apiKey: key, source: "vscode" }).listPages();
  } catch (e) {
    if (e instanceof ReadableApiError && e.status !== 0) valid = false;
  }

  if (!valid) {
    const proceed = await vscode.window.showWarningMessage(
      "API key validation failed. Save it anyway?",
      "Save",
      "Cancel",
    );
    if (proceed !== "Save") return;
  }

  const scope = await vscode.window.showQuickPick(["User settings (all workspaces)", "Workspace settings"], {
    placeHolder: "Where should the key be saved?",
  });

  if (!scope) return;

  const target = scope.startsWith("User")
    ? vscode.ConfigurationTarget.Global
    : vscode.ConfigurationTarget.Workspace;

  await config.update("apiKey", key, target);
  void vscode.window.showInformationMessage("Readable API key saved.");
}
