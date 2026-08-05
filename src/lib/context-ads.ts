import { wordpressSiteUrl } from './wordpress';

export type ContextAdPlacement = 'top' | 'middle' | 'bottom';

export interface ContextAd {
  id: string;
  elementId: string;
  advertiser: string;
  headline: string;
  image: string;
  destination: string;
  clickUrl: string;
  genre: string;
  cas?: string;
}

interface ContextAdResponse {
  postId: number;
  placement: ContextAdPlacement;
  ad: ContextAd | null;
}

export const contextAdEventUrl = new URL(
  '/wp-json/ca-manager/v1/context-ad/event',
  wordpressSiteUrl,
).toString();

export async function getContextAd(
  postId: number,
  placement: ContextAdPlacement,
): Promise<ContextAd | null> {
  const endpoint = new URL(
    '/wp-json/ca-manager/v1/context-ad',
    wordpressSiteUrl,
  );

  endpoint.searchParams.set('post_id', String(postId));
  endpoint.searchParams.set('placement', placement);

  try {
    const response = await fetch(endpoint);

    if (!response.ok) {
      console.warn(
        `コンテキスト広告を取得できませんでした: ${response.status} ${endpoint}`,
      );

      return null;
    }

    const payload = (await response.json()) as ContextAdResponse;

    return payload.ad;
  } catch (error) {
    console.warn('コンテキスト広告の取得中にエラーが発生しました。', error);

    return null;
  }
}
