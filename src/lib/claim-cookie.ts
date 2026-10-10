/** Name of the cookie that proves authorship of an anonymous page. Edge-safe: imported by src/middleware.ts. */
export function claimCookieName(pageId: string): string {
  return `booklet_claim_${pageId}`;
}
