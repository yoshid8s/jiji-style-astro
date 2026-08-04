import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const wordpressApiUrl = process.env.WORDPRESS_API_URL;
const articleSlug = process.env.CA_ARTICLE_SLUG;
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

function stripHtml(value) {
  return value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function getCategoryName(post) {
  const termGroups = post._embedded?.['wp:term'] ?? [];
  const categories = termGroups.find((terms) =>
    terms.some((term) => term.taxonomy === 'category'),
  );

  return categories?.[0]?.name ?? undefined;
}

function decodeJwtPayload(jwt) {
  const [, payload] = jwt.split('.');

  if (!payload) {
    return undefined;
  }

  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');

  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
}

function findJwt(value) {
  if (typeof value === 'string' && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(findJwt).find(Boolean);
  }

  if (value && typeof value === 'object') {
    return Object.values(value).map(findJwt).find(Boolean);
  }

  return undefined;
}

const apiUrl = requireEnvironment('WORDPRESS_API_URL', wordpressApiUrl);
const slug = requireEnvironment('CA_ARTICLE_SLUG', articleSlug);
const serverUrl = requireEnvironment('CA_SERVER_URL', caServerUrl);
const issuer = requireEnvironment('CA_ISSUER', caIssuer);
const auth = requireEnvironment('CA_SERVER_AUTH', caServerAuth);

const postResponse = await fetch(
  `${apiUrl}/posts?slug=${encodeURIComponent(slug)}&status=publish&_embed=wp:featuredmedia,wp:term`,
  { headers: { Accept: 'application/json' } },
);

if (!postResponse.ok) {
  throw new Error(`WordPress post lookup failed: ${postResponse.status} ${postResponse.statusText}`);
}

const [post] = await postResponse.json();

if (!post) {
  throw new Error(`No published WordPress post matches slug: ${slug}`);
}

const articlePath = path.join(repositoryRoot, 'dist', slug, 'index.html');
const articleHtml = await readFile(articlePath, 'utf8');
const targetMatch = articleHtml.match(
  /<!-- ca-target:start -->([\s\S]*?)<!-- ca-target:end -->/,
);

if (!targetMatch?.[1]) {
  throw new Error(`CA target markers were not found in ${articlePath}`);
}

const targetHtml = targetMatch[1].trim();
const manifestPath = path.join(
  repositoryRoot,
  'src',
  'data',
  'content-attestations.json',
);
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const casUrl = `/cas/${post.id}_cas.json`;
const existingCasPath = path.join(repositoryRoot, 'public', casUrl);
let existingCaId;

try {
  const [existingJwt] = JSON.parse(await readFile(existingCasPath, 'utf8'));
  existingCaId = decodeJwtPayload(existingJwt)?.credentialSubject?.id;
} catch {
  // This article is being issued for the first time.
}

const postDate = post.date_gmt || post.date;
const modifiedDate = post.modified_gmt || post.modified || post.date_gmt || post.date;
const pageUrl = `https://style.yh-inc.jp/${slug}/`;
const attestation = {
  '@context': [
    'https://www.w3.org/ns/credentials/v2',
    'https://originator-profile.org/ns/credentials/v1',
    'https://originator-profile.org/ns/cip/v1',
    { '@language': 'ja-JP' },
  ],
  type: ['VerifiableCredential', 'ContentAttestation'],
  issuer,
  credentialSubject: {
    ...(existingCaId ? { id: existingCaId } : {}),
    type: 'Article',
    headline: stripHtml(post.title.rendered),
    description: stripHtml(post.excerpt.rendered),
    author: ['Yoshifumi Takeuchi'],
    editor: ['Yoshifumi Takeuchi'],
    datePublished: new Date(postDate).toISOString(),
    dateModified: new Date(modifiedDate).toISOString(),
    ...(getCategoryName(post) ? { genre: getCategoryName(post) } : {}),
  },
  allowedUrl: [pageUrl],
  target: [
    {
      type: 'TextTargetIntegrity',
      content: targetHtml,
      cssSelector: '#article-content',
    },
  ],
};

const issueResponse = await fetch(new URL('/ca', serverUrl), {
  method: 'POST',
  headers: {
    Authorization: `Basic ${Buffer.from(auth).toString('base64')}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(attestation),
});

const responseText = await issueResponse.text();

if (!issueResponse.ok) {
  throw new Error(`CA issuance failed: ${issueResponse.status} ${responseText}`);
}

let issueResponseBody;

try {
  issueResponseBody = JSON.parse(responseText);
} catch {
  issueResponseBody = responseText;
}

const issuedJwt = findJwt(issueResponseBody);

if (!issuedJwt) {
  throw new Error('CA server response did not include a Content Attestation JWT.');
}

await mkdir(path.dirname(existingCasPath), { recursive: true });
await writeFile(existingCasPath, `${JSON.stringify([issuedJwt], null, 2)}\n`);

manifest[slug] = {
  postId: post.id,
  casUrl,
  issuedAt: new Date().toISOString(),
};

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Issued CA for ${pageUrl}`);
console.log(`External CAS: ${casUrl}`);
