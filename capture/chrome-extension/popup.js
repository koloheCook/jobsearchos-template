import TurndownService from "./vendor/turndown.browser.es.js";
import { cleanTree } from "./dom-sanitize.js";
import { escapeHtmlLikeMarkdown } from "./markdown.js";
import { snapshotActiveSelection } from "./selection.js";

const MARKER = "jobSearchOS web capture inbox v1";
const COMPLETE = "<!-- capture-complete -->";
let inFlight = false;
let pendingSelection = null;

const configure = document.querySelector("#configure");
const capture = document.querySelector("#capture");
const snapshot = document.querySelector("#snapshot");
const preview = document.querySelector("#preview");
const status = document.querySelector("#status");

function setStatus(message) {
  status.textContent = message;
}

function id() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const now = new Date().toISOString().replace(/[-:.]/g, "");
  return `web-${now}-${[...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function cleanString(value, maximum = 2048) {
  return String(value ?? "").normalize("NFC").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]/g, "").replace(/[\r\n]+/g, " ").trim().slice(0, maximum);
}

function safeUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("The posting URL must be credential-free HTTPS.");
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^(token|auth|session|signature|key|code|jwt|access_token|id_token)$/i.test(key)) url.searchParams.delete(key);
  }
  return url.toString();
}

async function digest(value) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return `sha256:${[...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function normalizeBody(value) {
  return `${String(value).replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").trim()}\n`;
}

function transform(selectionHtml) {
  const documentNode = new DOMParser().parseFromString(`<main>${selectionHtml}</main>`, "text/html");
  const main = documentNode.querySelector("main");
  cleanTree(main);
  const turndown = new TurndownService({ bulletListMarker: "-", codeBlockStyle: "fenced", emDelimiter: "_" });
  turndown.addRule("dropImages", { filter: "img", replacement: (content, node) => node.alt || "" });
  const markdown = normalizeBody(escapeHtmlLikeMarkdown(turndown.turndown(main)));
  if (!markdown.trim() || /!\[[^\]]*\]\(|<[^>\n]+>/.test(markdown)) throw new Error("No captureable text remained after safety filtering.");
  const serializer = new XMLSerializer();
  const sanitizedHtml = [...main.childNodes].map((node) => serializer.serializeToString(node)).join("");
  const source = `<!doctype html>\n<html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'"><title>jobSearchOS source snapshot</title></head><body><main>${sanitizedHtml}</main></body></html>\n`;
  return { markdown, source };
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("jobsearchos-capture", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("settings");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storedHandle() {
  const db = await database();
  const transaction = db.transaction("settings", "readonly");
  const result = await requestToPromise(transaction.objectStore("settings").get("inbox"));
  db.close();
  return result;
}

async function saveHandle(handle) {
  const db = await database();
  const transaction = db.transaction("settings", "readwrite");
  transaction.objectStore("settings").put(handle, "inbox");
  await new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

async function validateHandle(handle) {
  if (!handle || handle.kind !== "directory" || handle.name !== "web-captures") throw new Error("Choose the jobSearchOS landing/web-captures folder.");
  const marker = await handle.getFileHandle("README.md");
  const text = await (await marker.getFile()).text();
  if (!text.includes(MARKER)) throw new Error("The selected folder does not contain the jobSearchOS inbox marker.");
}

async function ensureHandle() {
  const handle = await storedHandle();
  if (!handle) throw new Error("Choose the web-captures folder first.");
  if (await handle.queryPermission({ mode: "readwrite" }) !== "granted") {
    if (await handle.requestPermission({ mode: "readwrite" }) !== "granted") throw new Error("Write permission was not granted.");
  }
  await validateHandle(handle);
  return handle;
}

async function absent(handle, filename) {
  try {
    await handle.getFileHandle(filename);
    return false;
  } catch (error) {
    if (error.name === "NotFoundError") return true;
    throw error;
  }
}

async function writeNew(handle, filename, content) {
  if (!(await absent(handle, filename))) throw new Error(`Refusing to overwrite existing ${filename}.`);
  const file = await handle.getFileHandle(filename, { create: true });
  const writer = await file.createWritable();
  await writer.write(content);
  await writer.close();
}

async function writeFailureReceipt(message) {
  try {
    const handle = await storedHandle();
    if (!handle || await handle.queryPermission({ mode: "readwrite" }) !== "granted") return;
    await validateHandle(handle);
    let receipts;
    try {
      receipts = await handle.getDirectoryHandle("_receipts");
    } catch (error) {
      if (error.name !== "NotFoundError") throw error;
      receipts = await handle.getDirectoryHandle("_receipts", { create: true });
    }
    const receipt = {
      schemaVersion: 1,
      recordedAt: new Date().toISOString(),
      stage: "capture",
      code: "capture-failed",
      captureId: null,
      sourceOrigin: null,
      retryable: true,
      message: cleanString(message, 512),
      artifactsCreated: []
    };
    await writeNew(receipts, `${id()}.capture.capture-failed.json`, `${JSON.stringify(receipt, null, 2)}\n`);
  } catch {
    // A receipt is best effort. The visible status is the fallback when no folder is available.
  }
}

async function primeSelection() {
  capture.disabled = true;
  setStatus("Checking the selected job-description text...");
  try {
    const selected = await snapshotActiveSelection(chrome);
    if (selected.error) {
      setStatus(selected.error);
      return;
    }
    pendingSelection = selected;
    capture.disabled = false;
    setStatus("Selection ready. Capture will use this snapshot.");
  } catch (error) {
    setStatus(error.message || "The selection could not be read.");
  }
}

configure.addEventListener("click", async () => {
  try {
    const handle = await window.showDirectoryPicker({ mode: "readwrite", id: "jobsearchos-web-captures" });
    await validateHandle(handle);
    await saveHandle(handle);
    setStatus("web-captures folder configured.");
  } catch (error) {
    setStatus(error.message || "Folder selection was cancelled.");
  }
});

capture.addEventListener("click", async () => {
  if (inFlight || !pendingSelection) return;
  inFlight = true;
  capture.disabled = true;
  try {
    const selected = pendingSelection;
    const converted = transform(selected.html);
    preview.value = converted.markdown.slice(0, 4000);
    const handle = await ensureHandle();
    const captureId = id();
    const sourceName = `${captureId}.source.html`;
    const sourceUrl = safeUrl(selected.url);
    const snapshotValue = snapshot.checked ? converted.source : null;
    const frontmatter = {
      schema_version: 1,
      artifact_type: "job_description",
      trust_level: "untrusted_external_content",
      source_type: "web_selection",
      capture_id: captureId,
      source_url: sourceUrl,
      captured_from_url: sourceUrl,
      captured_at: new Date().toISOString(),
      page_title: cleanString(selected.title || "Selected job description"),
      capture_method: "dom_selection",
      converter: "turndown@7.2.4+jobsearchos.3",
      content_sha256: await digest(converted.markdown),
      source_snapshot: snapshotValue ? sourceName : null,
      source_snapshot_sha256: snapshotValue ? await digest(snapshotValue) : null,
      capture_complete: true
    };
    const header = Object.entries(frontmatter).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join("\n");
    const primary = `---\n${header}\n---\n\n${converted.markdown}\n${COMPLETE}\n`;
    if (snapshotValue) await writeNew(handle, sourceName, snapshotValue);
    await writeNew(handle, `${captureId}.jd.md`, primary);
    setStatus(`Saved ${captureId}.jd.md${snapshotValue ? " and source snapshot" : ""}.`);
  } catch (error) {
    const message = error.message || "Capture failed.";
    await writeFailureReceipt(message);
    setStatus(message);
  } finally {
    inFlight = false;
    capture.disabled = false;
  }
});

void primeSelection();
