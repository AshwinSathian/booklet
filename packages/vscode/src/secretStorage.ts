import * as vscode from "vscode";

const API_KEY_SECRET = "booklet.apiKey";

export function getApiKey(context: vscode.ExtensionContext): Thenable<string | undefined> {
  return context.secrets.get(API_KEY_SECRET);
}

export function setApiKeySecret(context: vscode.ExtensionContext, key: string): Thenable<void> {
  return context.secrets.store(API_KEY_SECRET, key);
}
