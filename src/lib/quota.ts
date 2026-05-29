// All signed-in users are on the single free plan — no tiers, no paywalls.
// Anonymous users get a constrained subset of capabilities.

export type PlanLimits = {
  pagesPerMonth: number;       // -1 = unlimited
  customSlugs: boolean;
  analytics: boolean;
  versionHistory: boolean;
  passwordProtection: boolean;
  apiAccess: boolean;
  apiKeysMax: number;          // -1 = unlimited
  teamsAccess: boolean;
  webhooks: boolean;
};

export const FREE_LIMITS: PlanLimits = {
  pagesPerMonth: -1,
  customSlugs: true,
  analytics: true,
  versionHistory: true,
  passwordProtection: true,
  apiAccess: true,
  apiKeysMax: -1,
  teamsAccess: true,
  webhooks: true,
};

export const ANONYMOUS_LIMITS: PlanLimits = {
  pagesPerMonth: 10,
  customSlugs: false,
  analytics: false,
  versionHistory: false,
  passwordProtection: false,
  apiAccess: false,
  apiKeysMax: 0,
  teamsAccess: false,
  webhooks: false,
};

export function canUseFeature(
  signedIn: boolean,
  feature: keyof PlanLimits,
): boolean {
  const limits = signedIn ? FREE_LIMITS : ANONYMOUS_LIMITS;
  const value = limits[feature];
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return false;
}
