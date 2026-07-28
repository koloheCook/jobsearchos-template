import { createHash, randomBytes } from "node:crypto";
import path from "node:path";

export const CAPTURE_DIRECTORY = "web-captures";
export const CAPTURE_MARKER = "jobSearchOS web capture inbox v1";
export const CAPTURE_ID = /^web-\d{8}T\d{9}Z-[a-f0-9]{32}$/;
export const COMPLETE_MARKER = "<!-- capture-complete -->";
const SHA256 = /^sha256:[a-f0-9]{64}$/;
const SOURCE_TYPES = new Set(["web_selection", "public_url", "manual_paste"]);
const METHODS = new Set(["dom_selection", "jsonld_jobposting", "manual_paste"]);

export function createCaptureId(now = new Date()) {
  const timestamp = now.toISOString().replace(/[-:.]/g, "").replace("Z", "Z");
  return `web-${timestamp}-${randomBytes(16).toString("hex")}`;
}

export function captureFilename(captureId, suffix) {
  if (!CAPTURE_ID.test(captureId)) throw new Error("capture ID does not match grammar v1");
  if (suffix !== ".jd.md" && suffix !== ".source.html") throw new Error("unsupported capture suffix");
  return `${captureId}${suffix}`;
}

export function captureRelativePath(captureId) {
  return path.posix.join(CAPTURE_DIRECTORY, captureFilename(captureId, ".jd.md"));
}

export function sha256(value) {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

export function normalizeBody(value) {
  return `${String(value).replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").trim()}\n`;
}

export function cleanPageString(value, maxLength = 2048) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]/g, "")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function sanitizeUrl(value, { receipt = false } = {}) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("source URL must use HTTPS");
  if (url.username || url.password) throw new Error("source URL must not contain credentials");
  url.hash = "";
  const sensitive = /^(token|auth|session|signature|key|code|jwt|access_token|id_token)$/i;
  for (const key of [...url.searchParams.keys()]) {
    if (sensitive.test(key)) url.searchParams.delete(key);
  }
  if (receipt) url.search = "";
  return url.toString();
}

function parseScalar(value, lineNumber) {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`frontmatter line ${lineNumber} must use a JSON-compatible scalar`);
  }
}

export function parseCaptureMarkdown(content) {
  const normalized = String(content).replace(/\r\n?/g, "\n");
  if (!normalized.startsWith("---\n")) throw new Error("missing capture frontmatter");
  const end = normalized.indexOf("\n---\n", 4);
  if (end === -1) throw new Error("unterminated capture frontmatter");
  const frontmatter = {};
  for (const [index, line] of normalized.slice(4, end).split("\n").entries()) {
    const match = /^([a-z0-9_]+): (.+)$/.exec(line);
    if (!match) throw new Error(`frontmatter line ${index + 2} is invalid`);
    if (Object.hasOwn(frontmatter, match[1])) throw new Error(`frontmatter key ${match[1]} is duplicated`);
    frontmatter[match[1]] = parseScalar(match[2], index + 2);
  }
  const bodyWithMarker = normalized.slice(end + 5);
  if (!bodyWithMarker.endsWith(`${COMPLETE_MARKER}\n`)) throw new Error("capture completion marker is missing");
  const body = bodyWithMarker.slice(0, -`${COMPLETE_MARKER}\n`.length);
  validateFrontmatter(frontmatter, body);
  return { frontmatter, body: normalizeBody(body) };
}

export function validateFrontmatter(frontmatter, body) {
  const required = [
    "schema_version", "artifact_type", "trust_level", "source_type", "capture_id",
    "source_url", "captured_from_url", "captured_at", "page_title", "capture_method",
    "converter", "content_sha256", "source_snapshot", "source_snapshot_sha256", "capture_complete",
  ];
  for (const key of required) if (!Object.hasOwn(frontmatter, key)) throw new Error(`frontmatter is missing ${key}`);
  if (frontmatter.schema_version !== 1 || frontmatter.artifact_type !== "job_description") throw new Error("unsupported capture schema");
  if (frontmatter.trust_level !== "untrusted_external_content") throw new Error("capture trust level is invalid");
  if (!SOURCE_TYPES.has(frontmatter.source_type) || !METHODS.has(frontmatter.capture_method)) throw new Error("capture source type or method is invalid");
  if (!CAPTURE_ID.test(frontmatter.capture_id)) throw new Error("capture ID is invalid");
  if (sanitizeUrl(frontmatter.source_url) !== frontmatter.source_url) throw new Error("source URL is not normalized");
  if (sanitizeUrl(frontmatter.captured_from_url) !== frontmatter.captured_from_url) throw new Error("captured-from URL is not normalized");
  if (typeof frontmatter.page_title !== "string" || frontmatter.page_title !== cleanPageString(frontmatter.page_title)) throw new Error("page title is invalid");
  if (typeof frontmatter.converter !== "string" || frontmatter.converter.length > 128) throw new Error("converter is invalid");
  if (!SHA256.test(frontmatter.content_sha256) || frontmatter.content_sha256 !== sha256(normalizeBody(body))) throw new Error("content hash does not match body");
  const expectedSnapshot = captureFilename(frontmatter.capture_id, ".source.html");
  const hasSnapshot = typeof frontmatter.source_snapshot === "string";
  if (hasSnapshot && frontmatter.source_snapshot !== expectedSnapshot) throw new Error("source snapshot filename is invalid");
  if (hasSnapshot && !SHA256.test(frontmatter.source_snapshot_sha256)) throw new Error("source snapshot hash is invalid");
  if (!hasSnapshot && (frontmatter.source_snapshot !== null || frontmatter.source_snapshot_sha256 !== null)) throw new Error("null snapshot fields must be paired");
  if (frontmatter.capture_complete !== true) throw new Error("capture is not complete");
}

export function formatCaptureMarkdown(frontmatter, body) {
  const normalizedBody = normalizeBody(body);
  const normalizedFrontmatter = {
    ...frontmatter,
    page_title: cleanPageString(frontmatter.page_title),
    source_url: sanitizeUrl(frontmatter.source_url),
    captured_from_url: sanitizeUrl(frontmatter.captured_from_url),
    content_sha256: sha256(normalizedBody),
    capture_complete: true,
  };
  validateFrontmatter(normalizedFrontmatter, normalizedBody);
  const lines = Object.entries(normalizedFrontmatter).map(([key, value]) => `${key}: ${JSON.stringify(value)}`);
  return `---\n${lines.join("\n")}\n---\n\n${normalizedBody}\n${COMPLETE_MARKER}\n`;
}
