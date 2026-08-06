import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const pageSlug = process.env.CA_PAGE_SLUG;
const caServerUrl = process.env.CA_SERVER_URL;
const caIssuer = process.env.CA_ISSUER;
const caServerAuth = process.env.CA_SERVER_AUTH;
const repositoryRoot = process.cwd();

function requireEnvironment(name, value) {
  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function decodeJwtPayload(jwt) {
  const [, payload] = jwt.split(".");

  if (!payload) {
    return undefined;
  }

  const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");

  return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
}

function findJwt(value) {
  if (
    typeof value === "string" &&
    /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(findJwt).find(Boolean);
  }

  if (value && typeof value === "object") {
    return Object.values(value).map(findJwt).find(Boolean);
  }

  return undefined;
}

async function issueAttestation(attestation) {
  const issueResponse = await fetch(new URL("/ca", serverUrl), {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(auth).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(attestation),
  });

  const responseText = await issueResponse.text();

  if (!issueResponse.ok) {
    throw new Error(
      `CA issuance failed: ${issueResponse.status} ${responseText}`,
    );
  }

  let responseBody;

  try {
    responseBody = JSON.parse(responseText);
  } catch {
    responseBody = responseText;
  }

  const issuedJwt = findJwt(responseBody);

  if (!issuedJwt) {
    throw new Error(
      "CA server response did not include a Content Attestation JWT.",
    );
  }

  return issuedJwt;
}

async function createFileIntegrity(filePath) {
  const bytes = await readFile(filePath);

  return `sha256-${createHash("sha256").update(bytes).digest("base64")}`;
}

const staticPages = {
  home: {
    headline: "JiJi Style",
    description: "A personal journal about clothing, style and living well.",
    type: "Article",
    outputPath: "index.html",
    urlPath: "/",
    casFileName: "home_cas.json",
  },
  about: {
    headline: "About JiJi",
    description: "JiJi Styleについて",
    type: "Article",
    outputPath: path.join("about", "index.html"),
    urlPath: "/about/",
    casFileName: "about_cas.json",
  },
};

const slug = requireEnvironment("CA_PAGE_SLUG", pageSlug);
const serverUrl = requireEnvironment("CA_SERVER_URL", caServerUrl);
const issuer = requireEnvironment("CA_ISSUER", caIssuer);
const auth = requireEnvironment("CA_SERVER_AUTH", caServerAuth);

const page = staticPages[slug];

if (!page) {
  throw new Error(`Unsupported static page slug: ${slug}`);
}

const pagePath = path.join(repositoryRoot, "dist", page.outputPath);
const pageHtml = await readFile(pagePath, "utf8");

const targetMatch = pageHtml.match(
  /<!-- ca-target:start -->([\s\S]*?)<!-- ca-target:end -->/,
);

if (!targetMatch?.[1]) {
  throw new Error(`CA target markers were not found in ${pagePath}`);
}

const targetElements = [
  ...targetMatch[1].matchAll(
    /<(p|h[1-6]|figcaption|pre)\b[^>]*\bid=(['"])(op-body-[^'"]+)\2[^>]*>[\s\S]*?<\/\1>/gi,
  ),
].map((match) => ({
  content: match[0],
  cssSelector: `#${match[3]}`,
}));

if (targetElements.length === 0) {
  throw new Error(`No stable CA target elements were found in ${pagePath}`);
}

const additionalTargets = [];

if (slug === "home") {
  const siteManifestPath = path.join(
    repositoryRoot,
    "public",
    "site-manifest.json",
  );

  const siteManifestIntegrity = await createFileIntegrity(siteManifestPath);

  additionalTargets.push({
    type: "ExternalResourceTargetIntegrity",
    integrity: siteManifestIntegrity,
  });
}

const manifestPath = path.join(
  repositoryRoot,
  "src",
  "data",
  "content-attestations.json",
);

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const casUrl = `/astro-cas/${page.casFileName}`;
const casPath = path.join(repositoryRoot, "public", casUrl);

let existingCaId = manifest[slug]?.caId;

try {
  const [existingJwt] = JSON.parse(await readFile(casPath, "utf8"));
  existingCaId ??= decodeJwtPayload(existingJwt)?.credentialSubject?.id;
} catch {
  // First issuance for this static page.
}

const pageUrl = new URL(page.urlPath, "https://style.yh-inc.jp").toString();
const caId = existingCaId || `urn:uuid:${randomUUID()}`;

const attestation = {
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://originator-profile.org/ns/credentials/v1",
    "https://originator-profile.org/ns/cip/v1",
    { "@language": "ja-JP" },
  ],
  type: ["VerifiableCredential", "ContentAttestation"],
  issuer,
  credentialSubject: {
    id: caId,
    type: page.type,
    headline: page.headline,
    description: page.description,
    author: ["Yoshifumi Takeuchi"],
    editor: ["Yoshifumi Takeuchi"],
  },
  allowedUrl: [pageUrl],
  target: [
    ...targetElements.map(({ content, cssSelector }) => ({
      type: "TextTargetIntegrity",
      content,
      cssSelector,
    })),
    ...additionalTargets,
  ],
};

const issuedJwt = await issueAttestation(attestation);

await mkdir(path.dirname(casPath), { recursive: true });
await writeFile(casPath, `${JSON.stringify([issuedJwt], null, 2)}\n`);

manifest[slug] = {
  pageId: slug,
  casUrl,
  caId,
  issuedAt: new Date().toISOString(),
};

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Issued static page CA for ${pageUrl}`);
console.log(`External static page CAS: ${casUrl}`);
console.log(`CA targets: ${targetElements.length + additionalTargets.length}`);
