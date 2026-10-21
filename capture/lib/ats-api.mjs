// ATS posting-API fallback for capture-url:
// job-boards.greenhouse.io pages carry no JSON-LD, so a Greenhouse posting's body is
// taken from Greenhouse's own Job Board API and recorded as capture_method
// "ats_api_content". Ashby is not resolved here: its pages do carry JSON-LD, and its
// board payload is one 13 MB document with no per-job endpoint.

export const GREENHOUSE_HOSTS = new Set(["job-boards.greenhouse.io", "boards.greenhouse.io", "job-boards.eu.greenhouse.io"]);
const GREENHOUSE_PATH = /^\/([a-z0-9_-]+)\/jobs\/(\d+)\/?$/i;

// Returns { ats, apiUrl } for a posting URL whose ATS exposes a per-job JSON endpoint, else null.
export function resolveAtsApi(pageUrl) {
  const url = new URL(pageUrl);
  if (url.protocol !== "https:") return null;
  if (GREENHOUSE_HOSTS.has(url.hostname)) {
    const match = GREENHOUSE_PATH.exec(url.pathname);
    if (!match) return null;
    const [, board, jobId] = match;
    return { ats: "greenhouse", apiUrl: `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs/${jobId}` };
  }
  return null;
}

// Greenhouse serves `content` as entity-escaped HTML (&lt;div&gt;...). Only the five
// entities it emits are decoded; anything else is left for the sanitizer to see literally.
const ENTITIES = { "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&amp;": "&" };
export function decodeGreenhouseContent(value) {
  return String(value).replace(/&(?:lt|gt|quot|#39|amp);/g, (entity) => ENTITIES[entity]);
}

// Normalizes an ATS API payload to { title, html }. Throws on any shape mismatch rather
// than producing a capture from a guessed field; a thrown error is the guard working.
export function postingFromAtsPayload(ats, payload) {
  if (ats === "greenhouse") {
    if (!payload || typeof payload !== "object") throw new Error("greenhouse job payload is not an object");
    if (typeof payload.content !== "string" || !payload.content.trim()) throw new Error("greenhouse job payload has no content");
    if (typeof payload.title !== "string" || !payload.title.trim()) throw new Error("greenhouse job payload has no title");
    return { title: payload.title, html: decodeGreenhouseContent(payload.content) };
  }
  throw new Error(`no ATS API normalizer for ${ats}`);
}
