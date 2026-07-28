import TurndownService from "turndown";
import domino from "@mixmark-io/domino";
// Shared modules live under chrome-extension/ because Chrome cannot import
// files outside the extension directory; node has no such constraint.
import { cleanTree } from "../chrome-extension/dom-sanitize.js";
import { escapeHtmlLikeMarkdown } from "../chrome-extension/markdown.js";

export function sanitizeAndConvert(html) {
  const window = domino.createWindow(`<!doctype html><body>${String(html)}</body>`);
  const main = window.document.body;
  cleanTree(main);
  const sanitized = [...main.childNodes].map((node) => node.outerHTML ?? String(node.nodeValue ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")).join("");
  const turndown = new TurndownService({ bulletListMarker: "-", codeBlockStyle: "fenced", emDelimiter: "_" });
  turndown.addRule("dropImages", { filter: "img", replacement: (content, node) => node.alt || "" });
  const markdown = escapeHtmlLikeMarkdown(turndown.turndown(main));
  if (/!\[[^\]]*\]\(/.test(markdown) || /<[^>\n]+>/.test(markdown)) throw new Error("converter produced unsafe Markdown");
  return { sanitizedHtml: sanitized, markdown };
}

export function wrapSnapshot(bodyHtml) {
  return `<!doctype html>\n<html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'"><title>jobSearchOS source snapshot</title></head><body><main>${bodyHtml}</main></body></html>\n`;
}
