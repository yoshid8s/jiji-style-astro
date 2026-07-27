export type PageSeo = {
  title: string;
  description?: string;
  canonical?: string;
  image?: string;
  type?: 'website' | 'article';
};

const siteName = 'JiJi Style';
const defaultDescription = 'Classic menswear and daily style from JiJi Style.';

export function createSeo(input: PageSeo) {
  return {
    title: input.title === siteName ? siteName : `${input.title} | ${siteName}`,
    description: input.description ?? defaultDescription,
    canonical: input.canonical,
    image: input.image,
    type: input.type ?? 'website',
    siteName,
  };
}
