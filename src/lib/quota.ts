import type { UserPlan } from "@/lib/db/types";

export type PlanLimits = {
  pagesPerMonth: number;           // -1 = unlimited
  permanentPages: boolean;
  customSlugs: boolean;
  analytics: boolean;
  versionHistory: boolean;
  passwordProtection: boolean;
  removeAttributionBadge: boolean;
  apiAccess: boolean;
  apiKeysMax: number;              // -1 = unlimited
  teamsAccess: boolean;
  webhooks: boolean;
};

const LIMITS: Record<UserPlan, PlanLimits> = {
  free: {
    pagesPerMonth: -1,
    permanentPages: true,
    customSlugs: true,
    analytics: true,
    versionHistory: true,
    passwordProtection: true,
    removeAttributionBadge: true,
    apiAccess: true,
    apiKeysMax: -1,
    teamsAccess: true,
    webhooks: true,
  },
  pro: {
    pagesPerMonth: -1,
    permanentPages: true,
    customSlugs: true,
    analytics: true,
    versionHistory: true,
    passwordProtection: true,
    removeAttributionBadge: true,
    apiAccess: true,
    apiKeysMax: 10,
    teamsAccess: false,
    webhooks: true,
  },
  teams: {
    pagesPerMonth: -1,
    permanentPages: true,
    customSlugs: true,
    analytics: true,
    versionHistory: true,
    passwordProtection: true,
    removeAttributionBadge: true,
    apiAccess: true,
    apiKeysMax: -1,
    teamsAccess: true,
    webhooks: true,
  },
};

export function getLimits(plan: UserPlan): PlanLimits {
  return LIMITS[plan];
}

export function canUseFeature(plan: UserPlan, feature: keyof PlanLimits): boolean {
  const value = LIMITS[plan][feature];
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return false;
}

// Anonymous users get the most constrained experience (no account)
export const ANONYMOUS_LIMITS: PlanLimits = {
  pagesPerMonth: 10,
  permanentPages: false,
  customSlugs: false,
  analytics: false,
  versionHistory: false,
  passwordProtection: false,
  removeAttributionBadge: false,
  apiAccess: false,
  apiKeysMax: 0,
  teamsAccess: false,
  webhooks: false,
};
