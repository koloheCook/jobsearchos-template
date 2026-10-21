import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { CAPTURE_DIRECTORY, CAPTURE_MARKER, formatCaptureMarkdown, parseCaptureMarkdown } from "./lib/capture-format.mjs";
import { sanitizeAndConvert, wrapSnapshot } from "./lib/html-sanitize.mjs";
import { writeCapture } from "./lib/capture-writer.mjs";
import { decodeGreenhouseContent, postingFromAtsPayload, resolveAtsApi } from "./lib/ats-api.mjs";
import { escapeHtmlLikeMarkdown } from "./chrome-extension/markdown.js";
import { snapshotActiveSelection } from "./chrome-extension/selection.js";

async function fixtureRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), "jobsearchos-capture-"));
  const inbox = path.join(root, "landing", CAPTURE_DIRECTORY);
  await mkdir(inbox, { recursive: true });
  await writeFile(path.join(inbox, "README.md"), `# Capture inbox\n\n${CAPTURE_MARKER}\n`);
  return root;
}

test("sanitizer removes active markup and converter does not emit images or raw HTML", () => {
  const result = sanitizeAndConvert('<h2>Invented role</h2><script>bad()</script><img src="https://evil.invalid/x" alt="diagram"><a href="javascript:bad()">ignore</a><ul><li>Safe item</li></ul>');
  assert.doesNotMatch(result.sanitizedHtml, /script|src=|javascript:/i);
  assert.doesNotMatch(result.markdown, /!\[|<[^>]+>|javascript:/i);
  assert.match(result.markdown, /Invented role/);
  assert.match(wrapSnapshot(result.sanitizedHtml), /default-src 'none'/);
});

test("sanitizer preserves safe text through structural wrappers while removing nested active markup", () => {
  const result = sanitizeAndConvert('<section><article><h3>Invented responsibilities</h3><script>alert("no")</script><ul><li>Safe item</li></ul></article></section>');
  assert.doesNotMatch(result.sanitizedHtml, /section|article|script/i);
  assert.match(result.markdown, /Invented responsibilities/);
  assert.match(result.markdown, /Safe item/);
});

test("sanitizer drops a link-wrapped image instead of failing the capture", () => {
  const result = sanitizeAndConvert('<p>Invented intro</p><a href="https://example.invalid/x"><img src="https://example.invalid/logo.png" alt="Invented logo"></a>');
  assert.doesNotMatch(result.markdown, /!\[/);
  assert.doesNotMatch(result.sanitizedHtml, /img|src=/i);
  assert.match(result.markdown, /Invented intro/);
  assert.match(result.markdown, /Invented logo/);
});

test("sanitizer removes active markup nested inside a link", () => {
  const result = sanitizeAndConvert('<a href="https://example.invalid"><span onclick="bad()">Invented apply</span><script>bad()</script></a>');
  assert.doesNotMatch(result.sanitizedHtml, /onclick|script/i);
  assert.match(result.markdown, /Invented apply/);
});

test("converter keeps literal angle brackets spanning lines", () => {
  const result = sanitizeAndConvert("<p>pay is < invented</p><p>tenure > 2 years</p>");
  assert.match(result.markdown, /pay is < invented/);
  assert.match(result.markdown, /tenure > 2 years/);
});

test("escaper neutralizes tag-shaped text spanning lines while keeping prose brackets", () => {
  assert.equal(escapeHtmlLikeMarkdown("see <img\nsrc=x onerror=y> text"), "see &lt;img\nsrc=x onerror=y> text");
  assert.equal(escapeHtmlLikeMarkdown("pay is < invented\ntenure > 2 years"), "pay is < invented\ntenure > 2 years");
});

test("converter escapes tag-shaped literal text split across paragraphs", () => {
  const result = sanitizeAndConvert("<p>see &lt;img</p><p>src=x onerror=y&gt;</p>");
  assert.match(result.markdown, /&lt;img/);
  assert.doesNotMatch(result.markdown, /<img/);
});

test("extension escapes HTML-like converter output as Markdown text", () => {
  const markdown = escapeHtmlLikeMarkdown("Use <option>literal</option> text.");
  assert.equal(markdown, "Use &lt;option&gt;literal&lt;/option&gt; text.");
  assert.doesNotMatch(markdown, /<[^>]+>/);
});

test("writer creates a complete primary artifact and optional snapshot without touching control files", async () => {
  const root = await fixtureRoot();
  const result = await writeCapture(root, {
    sourceType: "manual_paste",
    captureMethod: "manual_paste",
    sourceUrl: "https://careers.example.invalid/jobs/123?token=redacted&job=123",
    pageTitle: "Invented\nRole",
    converter: "manual-paste@1",
    body: "# Invented Role\n\nText",
    snapshotHtml: "<html><body>invented</body></html>\n",
  });
  const primary = await readFile(path.join(root, "landing", result.primary), "utf8");
  const parsed = parseCaptureMarkdown(primary);
  assert.equal(parsed.frontmatter.source_url, "https://careers.example.invalid/jobs/123?job=123");
  assert.equal(parsed.frontmatter.page_title, "Invented Role");
  assert.equal(parsed.frontmatter.source_snapshot, path.basename(result.snapshot));
  assert.equal(parsed.body, "# Invented Role\n\nText\n");
});

test("ats_api_content is an accepted capture method and captured_from_url may name the API endpoint", async () => {
  const root = await fixtureRoot();
  const result = await writeCapture(root, {
    sourceType: "public_url",
    captureMethod: "ats_api_content",
    sourceUrl: "https://job-boards.greenhouse.io/invented/jobs/123",
    capturedFromUrl: "https://boards-api.greenhouse.io/v1/boards/invented/jobs/123",
    pageTitle: "Invented role",
    converter: "turndown@7.2.4+jobsearchos.3",
    body: "Invented text",
    snapshotHtml: null,
  });
  const parsed = parseCaptureMarkdown(await readFile(path.join(root, "landing", result.primary), "utf8"));
  assert.equal(parsed.frontmatter.capture_method, "ats_api_content");
  assert.equal(parsed.frontmatter.captured_from_url, "https://boards-api.greenhouse.io/v1/boards/invented/jobs/123");
});

test("ATS API resolver maps Greenhouse job pages to the per-job endpoint and nothing else", () => {
  assert.deepEqual(resolveAtsApi("https://job-boards.greenhouse.io/invented/jobs/123?gh_src=x"),
    { ats: "greenhouse", apiUrl: "https://boards-api.greenhouse.io/v1/boards/invented/jobs/123" });
  assert.deepEqual(resolveAtsApi("https://boards.greenhouse.io/invented/jobs/123"),
    { ats: "greenhouse", apiUrl: "https://boards-api.greenhouse.io/v1/boards/invented/jobs/123" });
  assert.equal(resolveAtsApi("https://job-boards.greenhouse.io/invented"), null);
  assert.equal(resolveAtsApi("https://jobs.ashbyhq.com/invented/0a0a0a0a-0000-0000-0000-000000000000"), null);
  assert.equal(resolveAtsApi("https://careers.example.invalid/jobs/123"), null);
  assert.equal(resolveAtsApi("http://job-boards.greenhouse.io/invented/jobs/123"), null);
});

test("Greenhouse API payload is decoded from entity-escaped HTML and rejected on shape mismatch", () => {
  const posting = postingFromAtsPayload("greenhouse", {
    title: "Invented role",
    content: "&lt;h2&gt;About&lt;/h2&gt;&lt;p&gt;Tom &amp; Jerry&#39;s &quot;team&quot;&lt;/p&gt;&lt;script&gt;bad()&lt;/script&gt;",
  });
  assert.equal(posting.title, "Invented role");
  assert.equal(posting.html, '<h2>About</h2><p>Tom & Jerry\'s "team"</p><script>bad()</script>');
  const converted = sanitizeAndConvert(posting.html);
  assert.doesNotMatch(converted.sanitizedHtml, /script/i);
  assert.match(converted.markdown, /Tom & Jerry's "team"/);
  assert.equal(decodeGreenhouseContent("&nbsp;&lt;"), "&nbsp;<");
  assert.throws(() => postingFromAtsPayload("greenhouse", { title: "x" }), /no content/);
  assert.throws(() => postingFromAtsPayload("greenhouse", { content: "x" }), /no title/);
  assert.throws(() => postingFromAtsPayload("greenhouse", null), /not an object/);
  assert.throws(() => postingFromAtsPayload("ashby", {}), /no ATS API normalizer/);
});

test("capture parser rejects a malformed completion contract", () => {
  const id = "web-20260715T123456789Z-0123456789abcdef0123456789abcdef";
  const valid = formatCaptureMarkdown({
    schema_version: 1,
    artifact_type: "job_description",
    trust_level: "untrusted_external_content",
    source_type: "manual_paste",
    capture_id: id,
    source_url: "https://careers.example.invalid/jobs/123",
    captured_from_url: "https://careers.example.invalid/jobs/123",
    captured_at: "2026-07-15T12:34:56.789Z",
    page_title: "Invented role",
    capture_method: "manual_paste",
    converter: "manual-paste@1",
    content_sha256: "sha256:pending",
    source_snapshot: null,
    source_snapshot_sha256: null,
    capture_complete: true,
  }, "Invented text");
  assert.throws(() => parseCaptureMarkdown(valid.replace("<!-- capture-complete -->", "<!-- incomplete -->")), /completion marker/);
});

test("capture parser can read historical opportunity metadata without accepting a changed inbox body", () => {
  const id = "web-20260715T123456789Z-0123456789abcdef0123456789abcdef";
  const valid = formatCaptureMarkdown({
    schema_version: 1,
    artifact_type: "job_description",
    trust_level: "untrusted_external_content",
    source_type: "public_url",
    capture_id: id,
    source_url: "https://careers.example.invalid/jobs/123",
    captured_from_url: "https://careers.example.invalid/jobs/123",
    captured_at: "2026-07-15T12:34:56.789Z",
    page_title: "Invented role",
    capture_method: "jsonld_jobposting",
    converter: "test@1",
    content_sha256: "sha256:pending",
    source_snapshot: null,
    source_snapshot_sha256: null,
    capture_complete: true,
  }, "Original invented text");
  const changed = valid.replace("Original invented text", "Changed invented text");
  assert.throws(() => parseCaptureMarkdown(changed), /content hash does not match body/);
  assert.equal(parseCaptureMarkdown(changed, { verifyContentHash: false }).frontmatter.source_url, "https://careers.example.invalid/jobs/123");
});

test("extension snapshots the top-frame selection before capture", async () => {
  const selected = { html: "<p>Invented role</p>", url: "https://careers.example.invalid/jobs/123", title: "Invented role" };
  const calls = [];
  const chromeApi = {
    tabs: {
      async query(query) {
        calls.push({ type: "query", query });
        return [{ id: 123 }];
      }
    },
    scripting: {
      async executeScript(options) {
        calls.push({ type: "execute", options });
        return [{ result: selected }];
      }
    }
  };

  assert.equal(await snapshotActiveSelection(chromeApi), selected);
  assert.deepEqual(calls[0], { type: "query", query: { active: true, currentWindow: true } });
  assert.equal(calls[1].type, "execute");
  assert.deepEqual(calls[1].options.target, { tabId: 123 });
  assert.equal(calls[1].options.world, "ISOLATED");
  assert.equal(typeof calls[1].options.func, "function");
});

test("extension manifest keeps its narrow permission and no-network boundary", async () => {
  const extension = path.join(path.dirname(fileURLToPath(import.meta.url)), "chrome-extension");
  const manifest = JSON.parse(await readFile(path.join(extension, "manifest.json"), "utf8"));
  assert.deepEqual(manifest.permissions, ["activeTab", "scripting"]);
  assert.equal(Object.hasOwn(manifest, "host_permissions"), false);
  assert.match(manifest.content_security_policy.extension_pages, /connect-src 'none'/);
  const source = await readFile(path.join(extension, "popup.js"), "utf8");
  assert.doesNotMatch(source, /innerHTML|window\.postMessage|new Function|eval\(/);
  assert.match(source, /import \{ cleanTree \} from "\.\/dom-sanitize\.js";/);
  assert.doesNotMatch(source, /removeUnsafe/);
  assert.match(source, /escapeHtmlLikeMarkdown\(turndown\.turndown\(main\)\)/);
  assert.match(source, /await snapshotActiveSelection\(chrome\)/);
  assert.match(source, /const selected = pendingSelection;/);
  assert.match(source, /void primeSelection\(\)/);
});
