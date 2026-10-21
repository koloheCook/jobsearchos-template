// Board adapters. Each returns a normalized posting list from one ATS board API.
// Normalized posting: { atsId, title, location, url, publishedAt }
// atsId is the ATS's own stable identifier, stringified. It is the diff key.

const TIMEOUT_MS = 20_000;

async function getJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "jobSearchOS-board-watch/0.1", Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function str(value) {
  return value === null || value === undefined ? "" : String(value);
}

export const adapters = {
  greenhouse: {
    endpoint: (token) => `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=false`,
    parse(payload) {
      const jobs = payload?.jobs;
      if (!Array.isArray(jobs)) throw new Error("greenhouse payload has no jobs array");
      return jobs.map((job) => ({
        atsId: str(job.id),
        title: str(job.title),
        location: str(job.location?.name),
        url: str(job.absolute_url),
        publishedAt: str(job.first_published || job.updated_at),
      }));
    },
  },
  ashby: {
    endpoint: (token) => `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(token)}`,
    parse(payload) {
      const jobs = payload?.jobs ?? payload?.postings;
      if (!Array.isArray(jobs)) throw new Error("ashby payload has no jobs array");
      return jobs.map((job) => ({
        atsId: str(job.id),
        title: str(job.title),
        location: str(job.location),
        url: str(job.jobUrl || job.applyUrl),
        publishedAt: str(job.publishedAt || job.updatedAt),
      }));
    },
  },
  lever: {
    endpoint: (token) => `https://api.lever.co/v0/postings/${encodeURIComponent(token)}?mode=json`,
    parse(payload) {
      if (!Array.isArray(payload)) throw new Error("lever payload is not an array");
      return payload.map((job) => ({
        atsId: str(job.id),
        title: str(job.text),
        location: str(job.categories?.location),
        url: str(job.hostedUrl || job.applyUrl),
        publishedAt: job.createdAt ? new Date(job.createdAt).toISOString() : "",
      }));
    },
  },
};

export async function fetchBoard(board, fetchJson = getJson) {
  const adapter = adapters[board.ats];
  if (!adapter) throw new Error(`unknown ats: ${board.ats}`);
  const payload = await fetchJson(adapter.endpoint(board.token));
  const postings = adapter.parse(payload);
  for (const posting of postings) {
    if (!posting.atsId) throw new Error(`${board.org}: a posting has no id`);
    if (!/^https:\/\//.test(posting.url)) throw new Error(`${board.org}: posting ${posting.atsId} has a non-HTTPS url`);
  }
  return postings;
}
