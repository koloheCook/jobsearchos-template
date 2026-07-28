#!/usr/bin/env node

import { lookup } from "node:dns/promises";
import https from "node:https";
import { readFile } from "node:fs/promises";
import { isIP } from "node:net";
import { fileURLToPath } from "node:url";
import path from "node:path";
import domino from "@mixmark-io/domino";
import { sanitizeAndConvert, wrapSnapshot } from "../lib/html-sanitize.mjs";
import { sanitizeUrl } from "../lib/capture-format.mjs";
import { writeCapture, writeReceipt } from "../lib/capture-writer.mjs";

const MAX_URLS = 100;
const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 15_000;

function projectRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
}

function parseArgs(argv) {
  const urls = [];
  let file;
  let snapshot = true;
  let root = projectRoot();
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--url" && argv[index + 1]) urls.push(argv[++index]);
    else if (argv[index] === "--file" && argv[index + 1]) file = argv[++index];
    else if (argv[index] === "--no-snapshot") snapshot = false;
    else if (argv[index] === "--root" && argv[index + 1] && process.env.JOBSEARCHOS_TEST_MODE === "1") root = path.resolve(argv[++index]);
    else throw new Error(`unknown or incomplete argument: ${argv[index]}`);
  }
  return { urls, file, snapshot, root };
}

function publicAddress(address) {
  const family = isIP(address);
  if (family === 4) {
    const [a, b] = address.split(".").map(Number);
    return a !== 0 && a !== 10 && a !== 127 && a !== 169 && a !== 192 && !(a === 172 && b >= 16 && b <= 31) && !(a === 100 && b >= 64 && b <= 127) && !(a >= 224);
  }
  if (family === 6) {
    const lower = address.toLowerCase();
    if (lower === "::" || lower === "::1" || lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("ff")) return false;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
    return !mapped || publicAddress(mapped[1]);
  }
  return false;
}

async function pinnedLookup(hostname) {
  const addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] : await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => !publicAddress(address))) throw new Error("URL host resolves to a non-public address");
  return addresses[0];
}

async function fetchPublic(initial) {
  let url = new URL(initial);
  for (let redirects = 0; redirects <= 5; redirects += 1) {
    if (url.protocol !== "https:" || url.username || url.password) throw new Error("batch URLs must be credential-free HTTPS URLs");
    const pinned = await pinnedLookup(url.hostname);
    const response = await new Promise((resolve, reject) => {
      const request = https.request(url, {
        method: "GET",
        headers: { "User-Agent": "jobSearchOS-capture/0.1", Accept: "text/html,application/xhtml+xml", "Accept-Encoding": "identity" },
        servername: url.hostname,
        lookup: (_hostname, _options, callback) => callback(null, pinned.address, pinned.family),
      }, resolve);
      request.setTimeout(TIMEOUT_MS, () => request.destroy(new Error("request timed out")));
      request.on("error", reject);
      request.end();
    });
    if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
      const location = response.headers.location;
      response.resume();
      if (!location) throw new Error("redirect response has no location");
      url = new URL(location, url);
      continue;
    }
    if (response.statusCode !== 200) {
      response.resume();
      throw new Error(`HTTP status ${response.statusCode}`);
    }
    const type = String(response.headers["content-type"] ?? "").toLowerCase();
    const encoding = String(response.headers["content-encoding"] ?? "identity").toLowerCase();
    if (!type.includes("text/html") || (encoding !== "identity" && encoding !== "")) {
      response.resume();
      throw new Error("response is not an uncompressed HTML document");
    }
    const chunks = [];
    let length = 0;
    for await (const chunk of response) {
      length += chunk.length;
      if (length > MAX_BYTES) throw new Error("response exceeds 5 MiB limit");
      chunks.push(chunk);
    }
    return { url: url.toString(), html: Buffer.concat(chunks).toString("utf8") };
  }
  throw new Error("redirect limit exceeded");
}

function collectJobPostings(value, output, depth = 0) {
  if (depth > 64 || output.length > 10 || !value) return;
  if (Array.isArray(value)) {
    for (const item of value) collectJobPostings(item, output, depth + 1);
    return;
  }
  if (typeof value !== "object") return;
  const type = value["@type"];
  if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) output.push(value);
  if (Object.hasOwn(value, "@graph")) collectJobPostings(value["@graph"], output, depth + 1);
}

function extractJobPosting(html) {
  const document = domino.createWindow(html).document;
  const postings = [];
  for (const script of [...document.querySelectorAll('script[type="application/ld+json"]')]) {
    try {
      collectJobPostings(JSON.parse(script.textContent), postings);
    } catch {
      // Invalid third-party JSON-LD is ignored. A valid unambiguous posting is still required.
    }
  }
  const usable = postings.filter((posting) => typeof posting.description === "string" && posting.description.trim());
  if (usable.length !== 1) throw new Error(usable.length === 0 ? "no unambiguous JobPosting structured data found" : "multiple JobPosting entries require manual selection");
  return usable[0];
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const fromFile = options.file ? (await readFile(options.file, "utf8")).split(/\r?\n/).map((line) => line.trim()).filter(Boolean) : [];
  const urls = [...new Set([...options.urls, ...fromFile])];
  if (urls.length === 0 || urls.length > MAX_URLS) throw new Error(`provide between 1 and ${MAX_URLS} URLs`);
  let failed = 0;
  for (const input of urls) {
    try {
      const fetched = await fetchPublic(input);
      const posting = extractJobPosting(fetched.html);
      const converted = sanitizeAndConvert(posting.description);
      const sourceUrl = sanitizeUrl(fetched.url);
      const result = await writeCapture(options.root, {
        sourceType: "public_url",
        captureMethod: "jsonld_jobposting",
        sourceUrl,
        capturedFromUrl: sourceUrl,
        pageTitle: posting.title || "Public job posting",
        converter: "turndown@7.2.4+jobsearchos.3",
        body: converted.markdown,
        snapshotHtml: options.snapshot ? wrapSnapshot(converted.sanitizedHtml) : null,
      });
      console.log(`capture-url: wrote ${result.primary}`);
    } catch (error) {
      failed += 1;
      try {
        const receipt = await writeReceipt(options.root, "batch", "manual-selection-required", error.message, null, input);
        console.error(`capture-url: ${input}: ${error.message} (receipt: ${receipt})`);
      } catch {
        console.error(`capture-url: ${input}: ${error.message}`);
      }
    }
  }
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`capture-url: ${error.message}`);
  process.exitCode = 1;
});
