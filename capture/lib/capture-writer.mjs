import { constants } from "node:fs";
import { lstat, mkdir, open, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import {
  CAPTURE_DIRECTORY,
  CAPTURE_MARKER,
  captureFilename,
  createCaptureId,
  formatCaptureMarkdown,
  sanitizeUrl,
  sha256,
} from "./capture-format.mjs";

const MODE = 0o600;

function isWithin(root, target) {
  return target === root || target.startsWith(`${root}${path.sep}`);
}

async function ensureDirectory(directory) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const stat = await lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`unsafe capture directory: ${directory}`);
}

async function exclusiveWrite(filename, content) {
  const handle = await open(filename, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, MODE);
  try {
    await handle.writeFile(content, "utf8");
  } finally {
    await handle.close();
  }
}

async function verifyInbox(root) {
  const rootPath = path.resolve(root);
  const inbox = path.resolve(rootPath, "landing", CAPTURE_DIRECTORY);
  if (!isWithin(rootPath, inbox)) throw new Error("capture inbox escapes project root");
  await ensureDirectory(inbox);
  const resolvedRoot = await realpath(rootPath);
  if (!isWithin(resolvedRoot, await realpath(inbox))) throw new Error("capture inbox resolves outside project root");
  const marker = await readFile(path.join(inbox, "README.md"), "utf8");
  if (!marker.includes(CAPTURE_MARKER)) throw new Error("capture inbox marker is missing");
  return inbox;
}

export async function writeReceipt(root, stage, code, message, captureId = null, sourceUrl = null, artifactsCreated = [], options = {}) {
  const inbox = await verifyInbox(root);
  const receipts = path.join(inbox, "_receipts");
  await ensureDirectory(receipts);
  const eventId = createCaptureId();
  let sourceOrigin = null;
  try {
    if (sourceUrl) {
      const url = new URL(sourceUrl);
      sourceOrigin = `${url.protocol}//${url.host}`;
    }
  } catch {
    sourceOrigin = null;
  }
  const receipt = {
    schemaVersion: 1,
    recordedAt: new Date().toISOString(),
    stage,
    code,
    captureId,
    sourceOrigin,
    retryable: options.retryable ?? true,
    message,
    artifactsCreated,
  };
  const filename = path.join(receipts, `${eventId}.${stage}.${code}.json`);
  await exclusiveWrite(filename, `${JSON.stringify(receipt, null, 2)}\n`);
  return path.relative(root, filename);
}

export async function writeCapture(root, options) {
  const inbox = await verifyInbox(root);
  const body = options.body;
  const capturedAt = options.capturedAt ?? new Date().toISOString();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const captureId = createCaptureId();
    const primaryName = captureFilename(captureId, ".jd.md");
    const snapshotName = options.snapshotHtml ? captureFilename(captureId, ".source.html") : null;
    const frontmatter = {
      schema_version: 1,
      artifact_type: "job_description",
      trust_level: "untrusted_external_content",
      source_type: options.sourceType,
      capture_id: captureId,
      source_url: sanitizeUrl(options.sourceUrl),
      captured_from_url: sanitizeUrl(options.capturedFromUrl ?? options.sourceUrl),
      captured_at: capturedAt,
      page_title: options.pageTitle,
      capture_method: options.captureMethod,
      converter: options.converter,
      content_sha256: "sha256:pending",
      source_snapshot: snapshotName,
      source_snapshot_sha256: snapshotName ? sha256(options.snapshotHtml) : null,
      capture_complete: true,
    };
    const primary = formatCaptureMarkdown(frontmatter, body);
    const artifacts = [];
    try {
      if (snapshotName) {
        await exclusiveWrite(path.join(inbox, snapshotName), options.snapshotHtml);
        artifacts.push(path.posix.join(CAPTURE_DIRECTORY, snapshotName));
      }
      await exclusiveWrite(path.join(inbox, primaryName), primary);
      artifacts.push(path.posix.join(CAPTURE_DIRECTORY, primaryName));
      return { captureId, primary: path.posix.join(CAPTURE_DIRECTORY, primaryName), snapshot: snapshotName ? path.posix.join(CAPTURE_DIRECTORY, snapshotName) : null };
    } catch (error) {
      if (error.code === "EEXIST") continue;
      await writeReceipt(root, "capture", "write-failed", error.message, captureId, options.sourceUrl, artifacts);
      throw error;
    }
  }
  const error = new Error("capture ID collision limit reached");
  await writeReceipt(root, "capture", "collision-exhausted", error.message);
  throw error;
}
