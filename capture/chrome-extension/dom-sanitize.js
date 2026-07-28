const DROP = new Set(["SCRIPT", "STYLE", "LINK", "META", "IFRAME", "OBJECT", "EMBED", "FORM", "INPUT", "BUTTON", "TEXTAREA", "SELECT", "SVG", "CANVAS", "AUDIO", "VIDEO", "SOURCE", "IMG"]);
const KEEP = new Set(["P", "BR", "H1", "H2", "H3", "H4", "H5", "H6", "UL", "OL", "LI", "TABLE", "THEAD", "TBODY", "TR", "TH", "TD", "STRONG", "B", "EM", "I", "CODE", "PRE", "BLOCKQUOTE", "A", "SPAN", "DIV"]);

// Shared by the extension popup (browser DOM) and capture/lib/html-sanitize.mjs
// (domino DOM): numeric nodeType constants, no browser-only globals.
export function cleanTree(node) {
  for (const child of [...node.childNodes]) {
    if (child.nodeType === 8) {
      child.remove();
      continue;
    }
    if (child.nodeType !== 1) continue;
    if (DROP.has(child.tagName)) {
      const alt = child.tagName === "IMG" ? child.getAttribute("alt") : "";
      child.replaceWith(child.ownerDocument.createTextNode(alt || ""));
      continue;
    }
    if (child.getAttribute("aria-hidden") === "true" || child.hasAttribute("hidden")) {
      child.remove();
      continue;
    }
    for (const attribute of [...child.attributes]) child.removeAttribute(attribute.name);
    if (!KEEP.has(child.tagName)) {
      cleanTree(child);
      child.replaceWith(...[...child.childNodes]);
      continue;
    }
    if (child.tagName === "A") {
      cleanTree(child);
      child.replaceWith(...[...child.childNodes]);
      continue;
    }
    cleanTree(child);
  }
}
