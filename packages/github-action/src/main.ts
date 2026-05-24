import * as core from "@actions/core";
import { readFileSync } from "fs";
import { resolve } from "path";

async function run(): Promise<void> {
  const file = core.getInput("file", { required: true });
  const apiKey = core.getInput("api-key", { required: true });
  const pageId = core.getInput("page-id") || null;
  const visibility = core.getInput("visibility") || "unlisted";
  const baseUrl = core.getInput("base-url") || "https://readable.ashwinsathian.com";

  core.debug(`Publishing ${file} to ${baseUrl}`);

  let raw: string;
  try {
    raw = readFileSync(resolve(process.cwd(), file), "utf-8");
  } catch (e) {
    core.setFailed(`Could not read file: ${file} — ${e instanceof Error ? e.message : String(e)}`);
    return;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    "X-Readable-Source": "github-action",
  };

  let response: Response;
  let result: { id: string; url: string };

  try {
    if (pageId) {
      // Update existing page
      response = await fetch(`${baseUrl}/api/v1/pages/${pageId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ raw, visibility }),
      });
    } else {
      // Publish new page
      response = await fetch(`${baseUrl}/api/v1/publish`, {
        method: "POST",
        headers,
        body: JSON.stringify({ raw }),
      });
    }
  } catch (e) {
    core.setFailed(`Network error: ${e instanceof Error ? e.message : String(e)}`);
    return;
  }

  if (!response.ok) {
    let errMsg = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) errMsg += `: ${body.error}`;
    } catch {
      // ignore
    }
    core.setFailed(`Publish failed: ${errMsg}`);
    return;
  }

  try {
    result = (await response.json()) as { id: string; url: string };
  } catch {
    core.setFailed("Could not parse API response");
    return;
  }

  core.setOutput("id", result.id);
  core.setOutput("url", result.url);
  core.info(`Published: ${result.url}`);
}

void run();
