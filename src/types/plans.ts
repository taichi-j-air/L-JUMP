// Shared plan-related types and defaults for Free/Basic/Premium tiers.
export type PlanType = 'free' | 'basic' | 'premium' | 'developer'

export interface PlanLimits {
  scenarioStepLimit: number | null
  flexMessageTemplateLimit: number | null
  memberSiteLimit: number | null
  totalContentBlockLimit: number | null
  contentBlockPerSiteLimit: number | null
}

export interface PlanStripeSettings {
  productId?: string
  monthlyPriceId?: string
  yearlyPriceId?: string
}

export interface PlanFeatureConfig {
  marketingHighlights: string[]
  limits: PlanLimits
  stripe?: PlanStripeSettings
}

export const PLAN_TYPE_LABELS: Record<PlanType, string> = {
  free: 'フリープラン',
  basic: 'シルバー',
  premium: 'ゴールド',
  developer: '開発者向け',
}

export const DEFAULT_PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  free: {
    scenarioStepLimit: 20,
    flexMessageTemplateLimit: 2,
    memberSiteLimit: 1,
    totalContentBlockLimit: 5,
    contentBlockPerSiteLimit: 5,
  },
  basic: {
    scenarioStepLimit: 50,
    flexMessageTemplateLimit: null,
    memberSiteLimit: 3,
    totalContentBlockLimit: null,
    contentBlockPerSiteLimit: 15,
  },
  premium: {
    scenarioStepLimit: null,
    flexMessageTemplateLimit: null,
    memberSiteLimit: null,
    totalContentBlockLimit: null,
    contentBlockPerSiteLimit: null,
  },
  developer: {
    scenarioStepLimit: null,
    flexMessageTemplateLimit: null,
    memberSiteLimit: null,
    totalContentBlockLimit: null,
    contentBlockPerSiteLimit: null,
  },
}

const valueOrDefault = (value: number | null | undefined, fallback: number | null) =>
  value === undefined ? fallback : value

export const sanitizeLimitsForPlanType = (
  planType: PlanType,
  limits?: Partial<PlanLimits>
): PlanLimits => {
  const defaults = DEFAULT_PLAN_LIMITS[planType]
  return {
    scenarioStepLimit: valueOrDefault(limits?.scenarioStepLimit, defaults.scenarioStepLimit),
    flexMessageTemplateLimit: valueOrDefault(
      limits?.flexMessageTemplateLimit,
      defaults.flexMessageTemplateLimit
    ),
    memberSiteLimit: valueOrDefault(limits?.memberSiteLimit, defaults.memberSiteLimit),
    totalContentBlockLimit: valueOrDefault(
      limits?.totalContentBlockLimit,
      defaults.totalContentBlockLimit
    ),
    contentBlockPerSiteLimit: valueOrDefault(
      limits?.contentBlockPerSiteLimit,
      defaults.contentBlockPerSiteLimit
    ),
  }
}

export const createDefaultPlanFeatures = (planType: PlanType): PlanFeatureConfig => ({
  marketingHighlights: [],
  limits: { ...DEFAULT_PLAN_LIMITS[planType] },
  stripe: {},
})

const coerceStringArray = (raw: any): string[] => {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map((item) => String(item))
  if (typeof raw === 'string') return [raw]
  return []
}

const trimToUndefined = (value?: string | null) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export const normalizePlanType = (value: string | null | undefined): PlanType => {
  switch (value) {
    case 'basic':
    case 'silver':
      return 'basic'
    case 'premium':
    case 'gold':
      return 'premium'
    case 'developer':
      return 'developer'
    case 'free':
    default:
      return 'free'
  }
}

export const parsePlanFeatureConfig = (raw: any, planType: PlanType): PlanFeatureConfig => {
  if (typeof raw === 'string' || Array.isArray(raw)) {
    return {
      marketingHighlights: coerceStringArray(raw),
      limits: sanitizeLimitsForPlanType(planType),
      stripe: {},
    }
  }

  if (!raw || typeof raw !== 'object') {
    return createDefaultPlanFeatures(planType)
  }

  const marketingSource =
    'marketingHighlights' in raw
      ? raw.marketingHighlights
      : 'features' in raw
        ? raw.features
        : []

  const limitsSource = typeof raw.limits === 'object' ? raw.limits : {}
  const stripeSource = typeof raw.stripe === 'object' ? raw.stripe : {}

  return {
    marketingHighlights: coerceStringArray(marketingSource),
    limits: sanitizeLimitsForPlanType(planType, limitsSource),
    stripe: {
      productId: trimToUndefined(
        typeof stripeSource.productId === 'string' ? stripeSource.productId : undefined
      ),
      monthlyPriceId: trimToUndefined(
        typeof stripeSource.monthlyPriceId === 'string' ? stripeSource.monthlyPriceId : undefined
      ),
      yearlyPriceId: trimToUndefined(
        typeof stripeSource.yearlyPriceId === 'string' ? stripeSource.yearlyPriceId : undefined
      ),
    },
  }
}

export const buildPlanFeaturesPayload = (
  planType: PlanType,
  featureConfig: PlanFeatureConfig
) => ({
  marketingHighlights:
    featureConfig.marketingHighlights?.map((item) => item.trim()).filter(Boolean) || [],
  limits: sanitizeLimitsForPlanType(planType, featureConfig.limits),
  stripe: {
    productId: trimToUndefined(featureConfig.stripe?.productId),
    monthlyPriceId: trimToUndefined(featureConfig.stripe?.monthlyPriceId),
    yearlyPriceId: trimToUndefined(featureConfig.stripe?.yearlyPriceId),
  },
})
