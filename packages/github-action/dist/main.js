#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const fs_1 = require("fs");
const path_1 = require("path");
async function run() {
    const file = core.getInput("file", { required: true });
    const apiKey = core.getInput("api-key", { required: true });
    const pageId = core.getInput("page-id") || null;
    const visibility = core.getInput("visibility") || "unlisted";
    const baseUrl = core.getInput("base-url") || "https://readable.ashwinsathian.com";
    core.debug(`Publishing ${file} to ${baseUrl}`);
    let raw;
    try {
        raw = (0, fs_1.readFileSync)((0, path_1.resolve)(process.cwd(), file), "utf-8");
    }
    catch (e) {
        core.setFailed(`Could not read file: ${file} — ${e instanceof Error ? e.message : String(e)}`);
        return;
    }
    const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-Readable-Source": "github-action",
    };
    let response;
    let result;
    try {
        if (pageId) {
            // Update existing page
            response = await fetch(`${baseUrl}/api/v1/pages/${pageId}`, {
                method: "PATCH",
                headers,
                body: JSON.stringify({ raw, visibility }),
            });
        }
        else {
            // Publish new page
            response = await fetch(`${baseUrl}/api/v1/publish`, {
                method: "POST",
                headers,
                body: JSON.stringify({ raw }),
            });
        }
    }
    catch (e) {
        core.setFailed(`Network error: ${e instanceof Error ? e.message : String(e)}`);
        return;
    }
    if (!response.ok) {
        let errMsg = `HTTP ${response.status}`;
        try {
            const body = (await response.json());
            if (body.error)
                errMsg += `: ${body.error}`;
        }
        catch {
            // ignore
        }
        core.setFailed(`Publish failed: ${errMsg}`);
        return;
    }
    try {
        result = (await response.json());
    }
    catch {
        core.setFailed("Could not parse API response");
        return;
    }
    core.setOutput("id", result.id);
    core.setOutput("url", result.url);
    core.info(`Published: ${result.url}`);
}
void run();
