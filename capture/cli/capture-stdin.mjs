#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { writeCapture, writeReceipt } from "../lib/capture-writer.mjs";

function projectRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
}

function parseArgs(argv) {
  let sourceUrl;
  let title = "Manual job description capture";
  let root = projectRoot();
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--url" && argv[index + 1]) sourceUrl = argv[++index];
    else if (argv[index] === "--title" && argv[index + 1]) title = argv[++index];
    else if (argv[index] === "--root" && argv[index + 1] && process.env.JOBSEARCHOS_TEST_MODE === "1") root = path.resolve(argv[++index]);
    else throw new Error(`unknown or incomplete argument: ${argv[index]}`);
  }
  if (!sourceUrl) throw new Error("--url is required");
  return { sourceUrl, title, root };
}

async function stdin() {
  if (process.stdin.isTTY) return readFile(0, "utf8");
  return readFile(0, "utf8");
}

async function main() {
  const { sourceUrl, title, root } = parseArgs(process.argv.slice(2));
  const body = await stdin();
  if (!body.trim()) throw new Error("manual capture text is empty");
  const result = await writeCapture(root, {
    sourceType: "manual_paste",
    captureMethod: "manual_paste",
    sourceUrl,
    pageTitle: title,
    converter: "manual-paste@1",
    body,
    snapshotHtml: null,
  });
  console.log(`capture-stdin: wrote ${result.primary}`);
}

main().catch(async (error) => {
  try {
    const root = projectRoot();
    const receipt = await writeReceipt(root, "capture", "manual-paste-failed", error.message);
    console.error(`capture-stdin: ${error.message} (receipt: ${receipt})`);
  } catch {
    console.error(`capture-stdin: ${error.message}`);
  }
  process.exitCode = 1;
});
