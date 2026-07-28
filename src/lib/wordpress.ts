const WORDPRESS_API_URL = import.meta.env.WORDPRESS_API_URL;
const embeddedFields = 'wp:featuredmedia,wp:term';

export const wordpressSiteUrl = new URL(WORDPRESS_API_URL).origin;

if (!WORDPRESS_API_URL) {
  throw new Error('WORDPRESS_API_URLが設定されていません。.envを確認してください。');
}

export interface RenderedContent {
  rendered: string;
}

export interface FeaturedMedia {
  id: number;
  source_url: string;
  alt_text: string;
  media_details?: {
    width?: number;
    height?: number;
    sizes?: Record<
      string,
      {
        source_url: string;
        width: number;
        height: number;
      }
    >;
  };
}

export interface WordPressTerm {
  id: number;
  name: string;
  slug: string;
  taxonomy: string;
}

export interface WordPressCategory {
  id: number;
  name: string;
  slug: string;
  description: string;
  count: number;
  parent: number;
}

export interface WordPressPost {
  id: number;
  date: string;
  date_gmt: string;
  modified: string;
  slug: string;
  status: string;
  link: string;
  title: RenderedContent;
  excerpt: RenderedContent;
  content: RenderedContent;
  featured_media: number;
  categories: number[];
  tags: number[];
  _embedded?: {
    'wp:featuredmedia'?: FeaturedMedia[];
    'wp:term'?: WordPressTerm[][];
  };
}

async function fetchWordPress<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${WORDPRESS_API_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(
      `WordPress APIの取得に失敗しました: ${response.status} ${response.statusText}\n${url}`,
    );
  }

  return response.json() as Promise<T>;
}

export function getCategories(): Promise<WordPressCategory[]> {
  const params = new URLSearchParams({
    hide_empty: 'true',
    per_page: '100',
  });

  return fetchWordPress<WordPressCategory[]>(
    `/categories?${params.toString()}`,
  );
}

export async function getPosts(
  perPage = 10,
  page = 1,
): Promise<WordPressPost[]> {
  const params = new URLSearchParams({
    per_page: String(perPage),
    page: String(page),
    status: 'publish',
    _embed: embeddedFields,
  });

  return fetchWordPress<WordPressPost[]>(
    `/posts?${params.toString()}`,
  );
}

export function getPostsByCategory(
  categoryId: number,
  perPage = 100,
): Promise<WordPressPost[]> {
  const params = new URLSearchParams({
    categories: String(categoryId),
    per_page: String(perPage),
    status: 'publish',
    _embed: embeddedFields,
  });

  return fetchWordPress<WordPressPost[]>(
    `/posts?${params.toString()}`,
  );
}

export async function getAllPosts(): Promise<WordPressPost[]> {
  const allPosts: WordPressPost[] = [];
  let page = 1;

  while (true) {
    const params = new URLSearchParams({
      per_page: '100',
      page: String(page),
      status: 'publish',
      _embed: embeddedFields,
    });

    const response = await fetch(
      `${WORDPRESS_API_URL}/posts?${params.toString()}`,
      {
        headers: {
          Accept: 'application/json',
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        `WordPress記事の取得に失敗しました: ${response.status} ${response.statusText}`,
      );
    }

    const posts = (await response.json()) as WordPressPost[];

    allPosts.push(...posts);

    const totalPages = Number(response.headers.get('X-WP-TotalPages') ?? '1');

    if (page >= totalPages) {
      break;
    }

    page += 1;
  }

  return allPosts;
}

export function getFeaturedImage(
  post: WordPressPost,
): FeaturedMedia | undefined {
  return post._embedded?.['wp:featuredmedia']?.[0];
}

export function getPostCategories(post: WordPressPost): WordPressTerm[] {
  return (
    post._embedded?.['wp:term']?.find((terms) =>
      terms.some((term) => term.taxonomy === 'category'),
    ) ?? []
  );
}

export function decodeWordPressSlug(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}
