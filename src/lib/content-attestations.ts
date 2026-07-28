/**
 * Issued Content Attestation JWTs, keyed by the decoded WordPress post slug.
 *
 * Keep this map empty until a CA is reissued against the deployed Astro page.
 * WordPress-issued certificates must not be reused because the rendered HTML
 * has changed.
 */
const articleContentAttestations: Record<string, readonly string[]> = {};

export function getArticleContentAttestations(
  slug: string,
): readonly string[] {
  return articleContentAttestations[slug] ?? [];
}
