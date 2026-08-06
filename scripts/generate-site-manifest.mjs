import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const wordpressApiUrl = process.env.WORDPRESS_API_URL;
const siteUrlValue = process.env.SITE_URL ?? 'https://style.yh-inc.jp';
const repositoryRoot = process.cwd();

if (!wordpressApiUrl) {
  throw new Error('WORDPRESS_API_URL is required.');
}

const siteUrl = new URL(
  siteUrlValue.endsWith('/') ? siteUrlValue : `${siteUrlValue}/`,
).toString();

const sectionDefinitions = [
  {
    categorySlug: 'daily-style',
    role: 'daily-style',
    postCount: 3,
  },
  {
    categorySlug: 'shoes',
    role: 'wardrobe',
    postCount: 6,
  },
  {
    categorySlug: 'classic-menswear',
    role: 'classic-menswear',
    postCount: 6,
  },
];

function stripHtml(value) {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/gi, "'")
    .replace(/&#(?:x0*([0-9a-f]+)|0*(\d+));/gi, (_match, hex, decimal) =>
      String.fromCodePoint(
        Number.parseInt(hex || decimal, hex ? 16 : 10),
      ),
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeWordPressSlug(slug) {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

function createApiUrl(endpoint) {
  const apiBase = new URL(
    wordpressApiUrl.endsWith('/')
      ? wordpressApiUrl
      : `${wordpressApiUrl}/`,
  );

  return new URL(endpoint.replace(/^\//, ''), apiBase);
}

async function getCategories() {
  const endpoint = createApiUrl('categories');
  endpoint.searchParams.set('hide_empty', 'true');
  endpoint.searchParams.set('per_page', '100');
  endpoint.searchParams.set(
    '_fields',
    'id,name,slug,parent',
  );

  const response = await fetch(endpoint, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(
      `WordPress category lookup failed: ${response.status} ${endpoint}`,
    );
  }

  return response.json();
}

async function getAllPublishedPosts() {
  const posts = [];
  let page = 1;

  while (true) {
    const endpoint = createApiUrl('posts');
    endpoint.searchParams.set('status', 'publish');
    endpoint.searchParams.set('per_page', '100');
    endpoint.searchParams.set('page', String(page));
    endpoint.searchParams.set(
      '_fields',
      'id,date,slug,title,categories',
    );

    const response = await fetch(endpoint, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(
        `WordPress post lookup failed: ${response.status} ${endpoint}`,
      );
    }

    posts.push(...(await response.json()));

    const totalPages = Number(
      response.headers.get('X-WP-TotalPages') ?? '1',
    );

    if (page >= totalPages) {
      return posts;
    }

    page += 1;
  }
}

function selectSectionPosts(allPosts, categories, categorySlug, postCount) {
  const category = categories.find(
    (candidate) => candidate.slug === categorySlug,
  );

  if (!category) {
    throw new Error(
      `Home-page category was not found: ${categorySlug}`,
    );
  }

  const categoryIds = new Set([
    category.id,
    ...categories
      .filter((candidate) => candidate.parent === category.id)
      .map((candidate) => candidate.id),
  ]);

  return allPosts
    .filter((post) =>
      post.categories.some((categoryId) =>
        categoryIds.has(categoryId),
      ),
    )
    .sort(
      (first, second) =>
        new Date(second.date).getTime() -
        new Date(first.date).getTime(),
    )
    .slice(0, postCount);
}

function createManifestItem(post, role, position, attestations) {
  const slug = decodeWordPressSlug(post.slug);
  const issuedCa = attestations[slug];

  if (!issuedCa?.casUrl) {
    throw new Error(
      `No issued article CA was found for home-page article: ${slug} (post ${post.id})`,
    );
  }

  return {
    position,
    role,
    headline: stripHtml(post.title.rendered),
    url: new URL(`${encodeURI(slug)}/`, siteUrl).toString(),
    casUrl: new URL(
      issuedCa.casUrl.replace(/^\//, ''),
      siteUrl,
    ).toString(),
  };
}

const attestationManifestPath = path.join(
  repositoryRoot,
  'src',
  'data',
  'content-attestations.json',
);
const outputPath = path.join(
  repositoryRoot,
  'public',
  'site-manifest.json',
);

const attestations = JSON.parse(
  await readFile(attestationManifestPath, 'utf8'),
);

const [categories, allPosts] = await Promise.all([
  getCategories(),
  getAllPublishedPosts(),
]);

const sortedPosts = [...allPosts].sort(
  (first, second) =>
    new Date(second.date).getTime() -
    new Date(first.date).getTime(),
);

const featuredPost = sortedPosts[0];

if (!featuredPost) {
  throw new Error('No published WordPress posts were found.');
}

const selections = [
  {
    role: 'featured',
    posts: [featuredPost],
  },
  ...sectionDefinitions.map(
    ({ categorySlug, role, postCount }) => ({
      role,
      posts: selectSectionPosts(
        allPosts,
        categories,
        categorySlug,
        postCount,
      ),
    }),
  ),
];

let position = 1;
const items = selections.flatMap(({ role, posts }) =>
  posts.map((post) =>
    createManifestItem(
      post,
      role,
      position++,
      attestations,
    ),
  ),
);

let existingManifest;

try {
  existingManifest = JSON.parse(
    await readFile(outputPath, 'utf8'),
  );
} catch {
  existingManifest = undefined;
}

const stableManifest = {
  site: siteUrl,
  page: siteUrl,
  items,
};

const existingStableManifest = existingManifest
  ? {
      site: existingManifest.site,
      page: existingManifest.page,
      items: existingManifest.items,
    }
  : undefined;

const compositionChanged =
  JSON.stringify(existingStableManifest) !==
  JSON.stringify(stableManifest);

if (!compositionChanged) {
  console.log(
    `Site manifest is unchanged: ${items.length} item(s).`,
  );
  process.exit(0);
}

const manifest = {
  site: siteUrl,
  page: siteUrl,
  generatedAt: new Date().toISOString(),
  items,
};

await writeFile(
  outputPath,
  `${JSON.stringify(manifest, null, 2)}\n`,
);

console.log(`Generated ${outputPath}`);
console.log(`Manifest items: ${items.length}`);

for (const item of items) {
  console.log(
    `[${item.position}] ${item.role}: ${item.headline}`,
  );
}
