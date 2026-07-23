import * as vscode from "vscode";
import { createClient, BookletApiError } from "booklet-api-client";
import { setApiKeySecret } from "../secretStorage";

export async function setApiKey(context: vscode.ExtensionContext): Promise<void> {
  const key = await vscode.window.showInputBox({
    prompt: "Enter your Booklet API key",
    password: true,
    placeHolder: "rdbl_...",
    ignoreFocusOut: true,
  });

  if (!key) return;

  const config = vscode.workspace.getConfiguration("booklet");
  const baseUrl = config.get<string>("baseUrl") ?? "https://booklet-api.ashwinsathian.com";

  // Validate the key. Network errors (status 0, see BookletApiError) are
  // treated as valid — don't block saving a key just because the API was
  // briefly unreachable; only a real auth rejection should.
  let valid = true;
  try {
    await createClient({ baseUrl, apiKey: key, source: "vscode" }).listPages();
  } catch (e) {
    if (e instanceof BookletApiError && e.status !== 0) valid = false;
  }

  if (!valid) {
    const proceed = await vscode.window.showWarningMessage(
      "API key validation failed. Save it anyway?",
      "Save",
      "Cancel",
    );
    if (proceed !== "Save") return;
  }

  // Stored in VS Code's SecretStorage (OS keychain), never in settings.json.
  await setApiKeySecret(context, key);
  void vscode.window.showInformationMessage("Booklet API key saved.");
}
