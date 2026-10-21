import { GREENHOUSE_HOSTS } from "../capture/lib/ats-api.mjs";

const GREENHOUSE_PATH = /^\/[a-z0-9_-]+\/jobs\/(\d+)\/?$/i;
const ASHBY_PATH = /^\/[a-z0-9_-]+\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i;
const LEVER_PATH = /^\/[a-z0-9_-]+\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i;
const TRACKING_PARAMETERS = new Set(["src", "gh_src", "s_id", "ref", "source"]);

function greenhouseId(url) {
  const queryId = url.searchParams.get("gh_jid");
  if (/^\d+$/.test(queryId ?? "")) return queryId;
  if (!GREENHOUSE_HOSTS.has(url.hostname)) return null;
  return GREENHOUSE_PATH.exec(url.pathname)?.[1] ?? null;
}

function normalizedFallback(url) {
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  for (const parameter of [...url.searchParams.keys()]) {
    const lower = parameter.toLowerCase();
    if (lower.startsWith("utm_") || TRACKING_PARAMETERS.has(lower)) {
      url.searchParams.delete(parameter);
    }
  }
  url.searchParams.sort();
  const pathname = url.pathname.replace(/\/+$/, "");
  return `${url.origin}${pathname === "" ? "" : pathname}${url.search}`;
}

export function requisitionKey(sourceUrl) {
  const url = new URL(sourceUrl);
  const greenhouse = greenhouseId(url);
  if (greenhouse) return `greenhouse:${greenhouse}`;

  if (url.hostname === "jobs.ashbyhq.com") {
    const match = ASHBY_PATH.exec(url.pathname);
    if (match) return `ashby:${match[1].toLowerCase()}`;
  }

  if (url.hostname === "jobs.lever.co") {
    const match = LEVER_PATH.exec(url.pathname);
    if (match) return `lever:${match[1].toLowerCase()}`;
  }

  return `url:${normalizedFallback(url)}`;
}
