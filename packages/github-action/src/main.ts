import * as core from "@actions/core";
import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient, ReadableApiError } from "readable-api-client";

async function run(): Promise<void> {
  const file = core.getInput("file", { required: true });
  const apiKey = core.getInput("api-key", { required: true });
  const pageId = core.getInput("page-id") || null;
  const visibility = core.getInput("visibility") || "unlisted";
  const baseUrl = core.getInput("base-url") || "https://readable.ashwinsathian.com";

  if (visibility !== "public" && visibility !== "unlisted") {
    core.setFailed(`Invalid visibility: "${visibility}" — must be "public" or "unlisted"`);
    return;
  }

  core.debug(`Publishing ${file} to ${baseUrl}`);

  let raw: string;
  try {
    raw = readFileSync(resolve(process.cwd(), file), "utf-8");
  } catch (e) {
    core.setFailed(`Could not read file: ${file} — ${e instanceof Error ? e.message : String(e)}`);
    return;
  }

  const client = createClient({ baseUrl, apiKey, source: "github-action" });

  let result: { id: string; url: string };
  try {
    result = pageId
      ? await client.updatePage(pageId, { raw, visibility })
      : await client.publishPage(raw);
  } catch (e) {
    const message = e instanceof ReadableApiError ? e.message : e instanceof Error ? e.message : String(e);
    core.setFailed(`Publish failed: ${message}`);
    return;
  }

  core.setOutput("id", result.id);
  core.setOutput("url", result.url);
  core.info(`Published: ${result.url}`);
}

void run();
