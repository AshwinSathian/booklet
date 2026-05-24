import * as vscode from "vscode";
import { publishFile } from "./commands/publish";
import { publishSelection } from "./commands/publishSelection";
import { setApiKey } from "./commands/setApiKey";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("readable.publish", () => void publishFile()),
    vscode.commands.registerCommand("readable.publishSelection", () => void publishSelection()),
    vscode.commands.registerCommand("readable.setApiKey", () => void setApiKey()),
  );
}

export function deactivate(): void {}
