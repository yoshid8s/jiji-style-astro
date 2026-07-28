# Article Content Attestation

Each Astro article body has the stable target selector `#article-content`.

## Issuing a certificate

1. Deploy the Astro site to its production URL.
2. In CA Playground, select the deployed article URL and target `#article-content`.
3. Issue a new Content Attestation using the test OP configured in the CA Playground extension.
4. Add the issued CAS JWT to `src/lib/content-attestations.ts`, using the article's decoded WordPress slug as the key.
5. Rebuild and deploy.

Do not copy a certificate issued for the former WordPress output. The page HTML has changed, so certificates must be issued again against the deployed Astro page.

## Safety rules

- The component emits no `application/cas+json` script until at least one valid JWT is registered.
- Reissue a certificate whenever the attested article body changes.
- Keep ad and embedded-content attestations separate from this first article-body implementation.
