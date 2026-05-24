import * as vscode from "vscode";

export async function setApiKey(): Promise<void> {
  const key = await vscode.window.showInputBox({
    prompt: "Enter your Readable API key",
    password: true,
    placeHolder: "rdbl_...",
    ignoreFocusOut: true,
  });

  if (!key) return;

  const config = vscode.workspace.getConfiguration("readable");
  const baseUrl = config.get<string>("baseUrl") ?? "https://readable.ashwinsathian.com";

  // Validate the key
  let valid = false;
  try {
    const res = await fetch(`${baseUrl}/api/v1/pages`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    valid = res.ok;
  } catch {
    // ignore network errors — allow saving anyway
    valid = true;
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
