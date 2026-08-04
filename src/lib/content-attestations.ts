import issuedArticleCas from '../data/content-attestations.json';

interface IssuedArticleCa {
  casUrl: string;
}

const articleContentAttestations = issuedArticleCas as Record<
  string,
  IssuedArticleCa
>;

export function getArticleContentAttestations(
  slug: string,
): readonly string[] {
  const issuedCa = articleContentAttestations[slug];

  return issuedCa ? [issuedCa.casUrl] : [];
}
