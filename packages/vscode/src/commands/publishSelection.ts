import * as vscode from "vscode";
import { createClient, BookletApiError } from "booklet-api-client";
import { getApiKey } from "../secretStorage";

export async function publishSelection(context: vscode.ExtensionContext): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showWarningMessage("No active editor.");
    return;
  }

  const selection = editor.selection;
  const content = selection.isEmpty
    ? editor.document.getText()
    : editor.document.getText(selection);

  const config = vscode.workspace.getConfiguration("booklet");
  const apiKey = await getApiKey(context);
  const baseUrl = config.get<string>("baseUrl") ?? "https://booklet-api.ashwinsathian.com";

  if (!apiKey) {
    const action = await vscode.window.showErrorMessage(
      "No Booklet API key set.",
      "Set API Key",
    );
    if (action === "Set API Key") {
      await vscode.commands.executeCommand("booklet.setApiKey");
    }
    return;
  }

  let result: { id: string; url: string };
  try {
    result = await createClient({ baseUrl, apiKey, source: "vscode" }).publishPage(content);
  } catch (e) {
    const message = e instanceof BookletApiError ? e.message : e instanceof Error ? e.message : String(e);
    void vscode.window.showErrorMessage(`Booklet publish failed: ${message}`);
    return;
  }

  const label = selection.isEmpty ? "full file" : "selection";
  const action = await vscode.window.showInformationMessage(
    `Published (${label}): ${result.url}`,
    "Copy URL",
    "Open in Browser",
  );

  if (action === "Copy URL") {
    await vscode.env.clipboard.writeText(result.url);
  } else if (action === "Open in Browser") {
    await vscode.env.openExternal(vscode.Uri.parse(result.url));
  }
}
