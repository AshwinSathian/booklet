import * as vscode from "vscode";

async function doPublish(content: string, title: string): Promise<void> {
  const config = vscode.workspace.getConfiguration("readable");
  const apiKey = config.get<string>("apiKey");
  const baseUrl = config.get<string>("baseUrl") ?? "https://readable.ashwinsathian.com";

  if (!apiKey) {
    const action = await vscode.window.showErrorMessage(
      "No Readable API key set.",
      "Set API Key",
    );
    if (action === "Set API Key") {
      await vscode.commands.executeCommand("readable.setApiKey");
    }
    return;
  }

  let result: { id: string; url: string };
  try {
    const res = await fetch(`${baseUrl}/api/v1/publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-Readable-Source": "vscode",
      },
      body: JSON.stringify({ raw: content }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }

    result = (await res.json()) as { id: string; url: string };
  } catch (e) {
    void vscode.window.showErrorMessage(
      `Readable publish failed: ${e instanceof Error ? e.message : String(e)}`,
    );
    return;
  }

  const action = await vscode.window.showInformationMessage(
    `Published: ${title}`,
    "Copy URL",
    "Open in Browser",
  );

  if (action === "Copy URL") {
    await vscode.env.clipboard.writeText(result.url);
  } else if (action === "Open in Browser") {
    await vscode.env.openExternal(vscode.Uri.parse(result.url));
  }
}

export async function publishFile(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showWarningMessage("No active editor.");
    return;
  }

  const content = editor.document.getText();
  const title = editor.document.fileName.split("/").pop() ?? "Untitled";
  await doPublish(content, title);
}
