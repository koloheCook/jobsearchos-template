#!/usr/bin/env node

import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const API_VERSION = "2026-03-11";
const API_BASE = "https://api.notion.com/v1";
// Point these at your own Notion tracker (env vars keep the real IDs out of the repo).
// See .env.example. Placeholders below are fictional and will fail against the real API.
const DATABASE_ID = process.env.JOBSEARCHOS_NOTION_DATABASE_ID ?? "<YOUR_NOTION_DATABASE_ID>";
const DATA_SOURCE_ID = process.env.JOBSEARCHOS_NOTION_DATA_SOURCE_ID ?? "<YOUR_NOTION_DATA_SOURCE_ID>";
const DATA_SOURCE_URL = `collection://${DATA_SOURCE_ID}`;
const COMPANY_DATA_SOURCE_ID =
  process.env.JOBSEARCHOS_NOTION_COMPANY_SOURCE_ID ?? "<YOUR_NOTION_COMPANY_SOURCE_ID>";
const LIVE_STATUSES = ["Not Applied", "Applied", "AI Screen", "Phone Screen", "Interview"];
const OPTIONAL_PROPERTIES = ["Next Step", "Next Step Date", "jobSearchOS Folder", "Application"];
const APPLICATION_TYPES = ["url", "rich_text"];
const REQUIRED_PROPERTIES = {
  Role: "title",
  "Application Status": "status",
  "CC Status": "status",
  Interest: "select",
  "Date Applied": "date",
  "Last Edited": "last_edited_time",
  "🏢 Company": "relation",
};

function parseArgs(argv) {
  let root = process.cwd();
  let syncedAt = new Date().toISOString();
  let apiFixture = null;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--root" && argv[index + 1]) root = path.resolve(argv[++index]);
    else if (argument === "--synced-at" && argv[index + 1]) syncedAt = argv[++index];
    else if (argument === "--api-fixture" && argv[index + 1]) apiFixture = path.resolve(argv[++index]);
    else throw new Error(`unknown argument: ${argument}`);
  }
  if (!isIso(syncedAt)) throw new Error(`syncedAt is not valid ISO-8601: ${syncedAt}`);
  return { root, syncedAt, apiFixture };
}

function isIso(value) {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function slug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizedId(value) {
  return value.replace(/-/g, "").toLowerCase();
}

function plainText(items) {
  if (!Array.isArray(items)) return null;
  const value = items.map((item) => item.plain_text ?? "").join("").trim();
  return value || null;
}

function propertyValue(page, name, expectedType, optional = false) {
  const property = page.properties?.[name];
  if (!property) {
    if (optional) return null;
    throw new Error(`${page.url ?? page.id} is missing required property ${name}`);
  }
  if (property.type !== expectedType) {
    throw new Error(`${page.url ?? page.id} property ${name} must be ${expectedType}, found ${property.type}`);
  }
  if (expectedType === "title" || expectedType === "rich_text") return plainText(property[expectedType]);
  if (expectedType === "status" || expectedType === "select") return property[expectedType]?.name ?? null;
  if (expectedType === "date") return property.date?.start?.slice(0, 10) ?? null;
  if (expectedType === "last_edited_time") return property.last_edited_time ?? null;
  if (expectedType === "relation") return property.relation ?? [];
  return null;
}

// Notion models "Application" as either a url or a rich_text property depending on how the
// row was created, so read both rather than throwing the refresh out of contract over that.
function applicationUrl(page) {
  const property = page.properties?.Application;
  if (!property) return null;
  if (property.type === "url") return property.url ?? null;
  if (property.type === "rich_text") return plainText(property.rich_text);
  return null;
}

async function listOpportunityFolders(root) {
  try {
    const entries = await readdir(path.join(root, "opportunities"), { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

function validateSchema(dataSource) {
  const properties = dataSource.properties ?? {};
  const problems = [];
  for (const [name, expectedType] of Object.entries(REQUIRED_PROPERTIES)) {
    const actualType = properties[name]?.type;
    if (actualType !== expectedType) {
      problems.push(`${name} must be ${expectedType}, found ${actualType ?? "missing"}`);
    }
  }
  const optionalTypes = {
    "Next Step": "rich_text",
    "Next Step Date": "date",
    "jobSearchOS Folder": "rich_text",
  };
  for (const [name, expectedType] of Object.entries(optionalTypes)) {
    const actualType = properties[name]?.type;
    if (actualType && actualType !== expectedType) {
      problems.push(`${name} must be ${expectedType}, found ${actualType}`);
    }
  }
  const applicationType = properties.Application?.type;
  if (applicationType && !APPLICATION_TYPES.includes(applicationType)) {
    problems.push(`Application must be ${APPLICATION_TYPES.join(" or ")}, found ${applicationType}`);
  }
  if (problems.length > 0) throw new Error(`tracker schema is out of contract: ${problems.join("; ")}`);
  return OPTIONAL_PROPERTIES.filter((name) => !properties[name]);
}

function statusFilter() {
  return {
    or: LIVE_STATUSES.map((status) => ({
      property: "Application Status",
      status: { equals: status },
    })),
  };
}

function notionClient(apiBase, token) {
  async function request(relativePath, options = {}) {
    const response = await fetch(`${apiBase}${relativePath}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Notion-Version": API_VERSION,
        ...options.headers,
      },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = payload?.message ?? response.statusText ?? "request failed";
      throw new Error(`Notion API ${response.status}: ${detail}`);
    }
    return payload;
  }

  async function queryAll(dataSourceId, body, filterProperties) {
    const results = [];
    let startCursor;
    const parameters = new URLSearchParams();
    for (const property of filterProperties) parameters.append("filter_properties[]", property);
    const queryPath = `/data_sources/${dataSourceId}/query?${parameters.toString()}`;
    do {
      const payload = await request(queryPath, {
        method: "POST",
        body: JSON.stringify({ ...body, page_size: 100, ...(startCursor ? { start_cursor: startCursor } : {}) }),
      });
      if (!Array.isArray(payload.results)) throw new Error("Notion API query response is missing results");
      results.push(...payload.results);
      startCursor = payload.has_more ? payload.next_cursor : null;
      if (payload.has_more && !startCursor) throw new Error("Notion API query response has_more without next_cursor");
    } while (startCursor);
    return results;
  }

  return {
    retrieveDataSource: (dataSourceId) => request(`/data_sources/${dataSourceId}`),
    queryAll,
  };
}

function companyMap(companyPages) {
  const companies = new Map();
  for (const page of companyPages) {
    const company = propertyValue(page, "Company Name", "title");
    if (!company) throw new Error(`${page.url ?? page.id} has no Company Name`);
    companies.set(normalizedId(page.id), company);
  }
  return companies;
}

function resolveCompany(page, companies) {
  const relations = propertyValue(page, "🏢 Company", "relation");
  const names = [...new Set(relations.map((relation) => companies.get(normalizedId(relation.id))).filter(Boolean))];
  if (names.length === 0) {
    // A row whose Company relation is unset (or points at a company absent from the source) is a
    // per-row data gap, not a systemic failure. Return null so buildRows can quarantine just this
    // row into validation.companyUnresolved instead of failing the whole refresh closed. The
    // systemic case (no live row resolves any company) is caught in main().
    return null;
  }
  if (names.length > 1) {
    throw new Error(`${page.url ?? page.id} resolves to multiple companies: ${names.join(", ")}`);
  }
  return names[0];
}

function buildRows(pages, companies, missingProperties, folderKeys) {
  const missingNextStepDate = [];
  const pointerMissing = [];
  const pointerBroken = [];
  const companyUnresolved = [];
  const optional = new Set(missingProperties);
  const rows = [];
  for (const page of pages) {
    if (!page.url) throw new Error(`${page.id ?? "tracker row"} is missing its Notion URL`);
    const applicationStatus = propertyValue(page, "Application Status", "status");
    if (!LIVE_STATUSES.includes(applicationStatus)) {
      throw new Error(`${page.url ?? page.id} has an Application Status outside the live-row filter: ${JSON.stringify(applicationStatus)}`);
    }
    const company = resolveCompany(page, companies);
    if (company === null) {
      // Quarantine one unlinked row instead of freezing every good row over it. The row is
      // surfaced in validation.companyUnresolved so the owner can set its company in Notion.
      companyUnresolved.push(page.url);
      continue;
    }
    const nextStep = propertyValue(page, "Next Step", "rich_text", optional.has("Next Step"));
    const nextStepDate = propertyValue(page, "Next Step Date", "date", optional.has("Next Step Date"));
    const folderPointer = propertyValue(page, "jobSearchOS Folder", "rich_text", optional.has("jobSearchOS Folder"));
    if (!nextStepDate) missingNextStepDate.push(page.url);
    if (!folderPointer) pointerMissing.push(page.url);
    else if (!folderKeys.has(slug(folderPointer))) pointerBroken.push(page.url);
    const role = propertyValue(page, "Role", "title");
    const lastEdited = propertyValue(page, "Last Edited", "last_edited_time");
    if (!role) throw new Error(`${page.url} has no Role`);
    if (!isIso(lastEdited)) throw new Error(`${page.url} has an invalid Last Edited value: ${JSON.stringify(lastEdited)}`);
    rows.push({
      notionUrl: page.url,
      role,
      company,
      applicationStatus,
      ccStatus: propertyValue(page, "CC Status", "status"),
      interest: propertyValue(page, "Interest", "select"),
      dateApplied: propertyValue(page, "Date Applied", "date"),
      lastEdited,
      nextStep,
      nextStepDate,
      folderPointer,
      applicationUrl: applicationUrl(page),
    });
  }
  rows.sort((left, right) => compareText(left.notionUrl, right.notionUrl));
  return {
    rows,
    validation: {
      missingProperties,
      missingNextStepDate: missingNextStepDate.sort(compareText),
      pointerMissing: pointerMissing.sort(compareText),
      pointerBroken: pointerBroken.sort(compareText),
      companyUnresolved: companyUnresolved.sort(compareText),
    },
  };
}

async function writeAtomic(outputPath, content) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.tmp-${process.pid}`;
  try {
    await writeFile(temporaryPath, content, { encoding: "utf8", mode: 0o600 });
    await rename(temporaryPath, outputPath);
  } finally {
    await unlink(temporaryPath).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}

async function main() {
  const { root, syncedAt, apiFixture } = parseArgs(process.argv.slice(2));
  let trackerSchema;
  let trackerPages;
  let companyPages;
  let missingProperties;
  if (apiFixture) {
    if (process.env.JOBSEARCHOS_TEST_MODE !== "1") {
      throw new Error("--api-fixture is available only when JOBSEARCHOS_TEST_MODE=1");
    }
    const fixture = JSON.parse(await readFile(apiFixture, "utf8"));
    ({ trackerSchema, trackerPages, companyPages } = fixture);
    if (!trackerSchema || !Array.isArray(trackerPages) || !Array.isArray(companyPages)) {
      throw new Error("API fixture must contain trackerSchema, trackerPages, and companyPages");
    }
  } else {
    const token = process.env.NOTION_API_KEY;
    if (!token) throw new Error("NOTION_API_KEY is not set in the environment");
    const client = notionClient(API_BASE, token);
    trackerSchema = await client.retrieveDataSource(DATA_SOURCE_ID);
    missingProperties = validateSchema(trackerSchema);
    const trackerProperties = [
      ...Object.keys(REQUIRED_PROPERTIES),
      ...OPTIONAL_PROPERTIES.filter((name) => !missingProperties.includes(name)),
    ];
    [trackerPages, companyPages] = await Promise.all([
      client.queryAll(DATA_SOURCE_ID, { filter: statusFilter() }, trackerProperties),
      client.queryAll(COMPANY_DATA_SOURCE_ID, {}, ["Company Name"]),
    ]);
  }
  missingProperties ??= validateSchema(trackerSchema);
  const folders = await listOpportunityFolders(root);
  const folderKeys = new Set(folders.map(slug));
  const { rows, validation } = buildRows(trackerPages, companyMap(companyPages), missingProperties, folderKeys);
  if (trackerPages.length > 0 && rows.length === 0) {
    // Systemic failure: live tracker rows exist but not one resolved a company (e.g. the company
    // data source was empty or unreachable). Fail closed and keep the existing mirror rather than
    // overwrite it with one that lost every company. Individual unlinked rows are quarantined above.
    throw new Error(
      `no live tracker row resolved a company through ${COMPANY_DATA_SOURCE_ID} ` +
        `(${trackerPages.length} live rows, ${companyPages.length} companies in source); refusing to overwrite the mirror`,
    );
  }
  const mirror = {
    schemaVersion: 1,
    syncedAt,
    source: {
      databaseId: DATABASE_ID,
      dataSourceUrl: DATA_SOURCE_URL,
      liveFilter: `Application Status in [${LIVE_STATUSES.join(", ")}]`,
    },
    rowCount: rows.length,
    rows,
    validation,
  };
  const outputPath = path.join(root, "data", "tracker-mirror.json");
  await writeAtomic(outputPath, `${JSON.stringify(mirror, null, 2)}\n`);
  console.log(`refresh-tracker-mirror: wrote ${path.relative(root, outputPath)} (${rows.length} rows)`);
  console.log(`refresh-tracker-mirror: missing properties: ${missingProperties.length ? missingProperties.join(", ") : "none"}`);
  if (validation.companyUnresolved.length > 0) {
    console.warn(
      `refresh-tracker-mirror: ${validation.companyUnresolved.length} row(s) skipped -- no company set in Notion: ${validation.companyUnresolved.join(", ")}`,
    );
  }
}

main().catch((error) => {
  console.error(`refresh-tracker-mirror: ${error.message}`);
  process.exitCode = 1;
});
