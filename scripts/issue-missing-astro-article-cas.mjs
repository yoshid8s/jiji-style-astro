import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const wordpressApiUrl = process.env.WORDPRESS_API_URL;
const limitValue = process.env.CA_BULK_LIMIT ?? '0';
const repositoryRoot = process.cwd();

if (!wordpressApiUrl) {
  throw new Error('WORDPRESS_API_URL is required.');
}

const limit = Number(limitValue);

if (!Number.isInteger(limit) || limit < 0) {
  throw new Error('CA_BULK_LIMIT must be a non-negative integer.');
}

async function getPublishedPosts() {
  const posts = [];
  let page = 1;

  while (true) {
    const apiBase = new URL(
      wordpressApiUrl.endsWith('/') ? wordpressApiUrl : `${wordpressApiUrl}/`,
    );
    const endpoint = new URL('posts', apiBase);
    endpoint.searchParams.set('status', 'publish');
    endpoint.searchParams.set('per_page', '100');
    endpoint.searchParams.set('page', String(page));
    endpoint.searchParams.set('_fields', 'id,slug');

    const response = await fetch(endpoint, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(
        `WordPress post list lookup failed: ${response.status} ${endpoint}`,
      );
    }

    const batch = await response.json();
    posts.push(...batch);

    const totalPages = Number(response.headers.get('X-WP-TotalPages') ?? '1');

    if (page >= totalPages) {
      return posts;
    }

    page += 1;
  }
}

function decodeWordPressSlug(slug) {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

function runIssueScript(slug) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/issue-astro-article-ca.mjs'], {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        CA_ARTICLE_SLUG: slug,
      },
      stdio: 'inherit',
    });

    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`CA issuance failed for ${slug} (exit code ${code}).`));
      }
    });
  });
}

const manifestPath = path.join(
  repositoryRoot,
  'src',
  'data',
  'content-attestations.json',
);
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const posts = (await getPublishedPosts()).map((post) => ({
  ...post,
  slug: decodeWordPressSlug(post.slug),
}));
const unissuedPosts = posts.filter((post) => !manifest[post.slug]?.casUrl);
const targets = limit === 0 ? unissuedPosts : unissuedPosts.slice(0, limit);

console.log(`Published articles: ${posts.length}`);
console.log(`Articles without an Astro CA: ${unissuedPosts.length}`);
console.log(`Issuing this run: ${targets.length}`);

for (const [index, post] of targets.entries()) {
  console.log(`\n[${index + 1}/${targets.length}] ${post.slug} (post ${post.id})`);
  await runIssueScript(post.slug);
}

console.log(`\nCompleted: issued ${targets.length} missing article CA set(s).`);
