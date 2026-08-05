import issuedArticleCas from '../data/content-attestations.json';

interface IssuedArticleCa {
  casUrl: string;
  issuedAt: string;
  adsCasUrl?: string;
  adsIssuedAt?: string;
}

const articleContentAttestations = issuedArticleCas as Record<
  string,
  IssuedArticleCa
>;

export function getArticleContentAttestations(
  slug: string,
): readonly string[] {
  const issuedCa = articleContentAttestations[slug];

  if (!issuedCa) {
    return [];
  }

  const articleCasUrl = `${issuedCa.casUrl}?v=${encodeURIComponent(issuedCa.issuedAt)}`;
  const advertisementCasUrl =
    issuedCa.adsCasUrl && issuedCa.adsIssuedAt
      ? `${issuedCa.adsCasUrl}?v=${encodeURIComponent(issuedCa.adsIssuedAt)}`
      : undefined;

  return [articleCasUrl, ...(advertisementCasUrl ? [advertisementCasUrl] : [])];
}
