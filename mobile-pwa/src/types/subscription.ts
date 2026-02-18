// Subscription Tier Types and Data for Checks Happy

// Beta Mode - Set to false when ready to launch with pricing
export const BETA_MODE = true;

export type SubscriptionTier = 'trainee' | 'artist' | 'supervisor' | 'designer';
export type BillingPeriod = 'monthly' | 'yearly' | 'per_project';
export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'trialing' | null;

// Extended tier limits with all features
export interface TierFeatures {
  maxProjects: number; // -1 = unlimited
  maxArchivedProjects: number;
  maxPhotosPerProject: number; // -1 = unlimited
  canCreateProjects: boolean;
  offlineMode: boolean;
  exportReports: boolean;
  personalTemplates: boolean;
  teamManagement: boolean;
  characterProgressionTracking: boolean;
  shootingScheduleView: boolean;
  teamPhotoStorage: boolean;
  desktopWebAccess: boolean;
  preProductionBreakdown: boolean;
  characterDesignDocs: boolean;
  exportProductionBooks: boolean;
  budgetSchedulingTools: boolean;
}

export interface TierPricing {
  monthly: number;
  yearly: number;
  perProject?: number; // Only for Designer tier
  currency: string;
  currencySymbol: string;
}

export interface TierInfo {
  id: SubscriptionTier;
  name: string;
  displayName: string;
  description: string;
  pricing: TierPricing;
  features: TierFeatures;
  featureList: string[];
  isPopular?: boolean;
  isPremium?: boolean;
}

// Subscription data stored in user profile
export interface SubscriptionData {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  billingPeriod: BillingPeriod | null;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStartedAt?: Date;
  currentPeriodEndsAt?: Date;
  cancelAtPeriodEnd?: boolean;
}

// Tier feature configurations
export const TIER_FEATURES: Record<SubscriptionTier, TierFeatures> = {
  trainee: {
    maxProjects: 3,
    maxArchivedProjects: 1,
    maxPhotosPerProject: 50,
    canCreateProjects: false,
    offlineMode: false,
    exportReports: false,
    personalTemplates: false,
    teamManagement: false,
    characterProgressionTracking: false,
    shootingScheduleView: false,
    teamPhotoStorage: false,
    desktopWebAccess: false,
    preProductionBreakdown: false,
    characterDesignDocs: false,
    exportProductionBooks: false,
    budgetSchedulingTools: false,
  },
  artist: {
    maxProjects: 10,
    maxArchivedProjects: -1, // unlimited
    maxPhotosPerProject: 500,
    canCreateProjects: false,
    offlineMode: true,
    exportReports: true,
    personalTemplates: true,
    teamManagement: false,
    characterProgressionTracking: false,
    shootingScheduleView: false,
    teamPhotoStorage: false,
    desktopWebAccess: false,
    preProductionBreakdown: false,
    characterDesignDocs: false,
    exportProductionBooks: false,
    budgetSchedulingTools: false,
  },
  supervisor: {
    maxProjects: 25,
    maxArchivedProjects: 15,
    maxPhotosPerProject: 1000,
    canCreateProjects: true,
    offlineMode: true,
    exportReports: true,
    personalTemplates: true,
    teamManagement: true,
    characterProgressionTracking: true,
    shootingScheduleView: true,
    teamPhotoStorage: false,
    desktopWebAccess: false,
    preProductionBreakdown: false,
    characterDesignDocs: false,
    exportProductionBooks: false,
    budgetSchedulingTools: false,
  },
  designer: {
    maxProjects: -1, // unlimited
    maxArchivedProjects: -1,
    maxPhotosPerProject: -1, // unlimited
    canCreateProjects: true,
    offlineMode: true,
    exportReports: true,
    personalTemplates: true,
    teamManagement: true,
    characterProgressionTracking: true,
    shootingScheduleView: true,
    teamPhotoStorage: true,
    desktopWebAccess: true,
    preProductionBreakdown: true,
    characterDesignDocs: true,
    exportProductionBooks: true,
    budgetSchedulingTools: true,
  },
};

// Tier pricing (GBP)
export const TIER_PRICING: Record<SubscriptionTier, TierPricing> = {
  trainee: {
    monthly: 0,
    yearly: 0,
    currency: 'GBP',
    currencySymbol: '£',
  },
  artist: {
    monthly: 4.99,
    yearly: 47.90, // Save ~20%
    currency: 'GBP',
    currencySymbol: '£',
  },
  supervisor: {
    monthly: 9.99,
    yearly: 95.90, // Save ~20%
    currency: 'GBP',
    currencySymbol: '£',
  },
  designer: {
    monthly: 29.99,
    yearly: 287.90, // Save ~20%
    perProject: 49,
    currency: 'GBP',
    currencySymbol: '£',
  },
};

// Complete tier information
export const SUBSCRIPTION_TIERS: TierInfo[] = [
  {
    id: 'trainee',
    name: 'TRAINEE',
    displayName: 'Trainee',
    description: 'Perfect for students and emerging artists',
    pricing: TIER_PRICING.trainee,
    features: TIER_FEATURES.trainee,
    featureList: [
      'Multiple projects simultaneously',
      '50 photos per project',
      'View breakdowns & scenes',
      'Add continuity notes',
      '1 archived project',
    ],
  },
  {
    id: 'artist',
    name: 'ARTIST',
    displayName: 'Artist',
    description: 'For working floor artists',
    pricing: TIER_PRICING.artist,
    features: TIER_FEATURES.artist,
    featureList: [
      'Everything in Trainee',
      '500 photos per project',
      'Offline mode with full sync',
      'Export continuity reports (PDF)',
      'Personal templates between projects',
      'Unlimited project archive',
    ],
    isPopular: true,
  },
  {
    id: 'supervisor',
    name: 'SUPERVISOR',
    displayName: 'Supervisor',
    description: 'For supervisors and key artists',
    pricing: TIER_PRICING.supervisor,
    features: TIER_FEATURES.supervisor,
    featureList: [
      'Everything in Artist',
      '1000 photos per project',
      'Create & manage projects',
      'Generate team invite codes',
      'Team management',
      'Character progression tracking',
      'Shooting schedule view',
    ],
  },
  {
    id: 'designer',
    name: 'DESIGNER',
    displayName: 'Designer',
    description: 'The complete package for HODs and designers',
    pricing: TIER_PRICING.designer,
    features: TIER_FEATURES.designer,
    featureList: [
      'Everything in Supervisor',
      'Unlimited photo storage',
      'Team photo storage included',
      'Full desktop web access',
      'Pre-production script breakdown',
      'Character design documentation',
      'Export full production books',
      'Budget & scheduling tools',
    ],
    isPremium: true,
  },
];

// Helper functions
export const getTierById = (tierId: SubscriptionTier): TierInfo | undefined => {
  return SUBSCRIPTION_TIERS.find(tier => tier.id === tierId);
};

export const formatPrice = (price: number, currencySymbol: string = '£'): string => {
  if (price === 0) return 'Free';
  return `${currencySymbol}${price.toFixed(2)}`;
};

export const formatMonthlyEquivalent = (yearlyPrice: number, currencySymbol: string = '£'): string => {
  const monthly = yearlyPrice / 12;
  return `${currencySymbol}${monthly.toFixed(2)}`;
};

export const calculateYearlySavings = (monthlyPrice: number, yearlyPrice: number): number => {
  const fullYearlyPrice = monthlyPrice * 12;
  return Math.round(((fullYearlyPrice - yearlyPrice) / fullYearlyPrice) * 100);
};

// Check if a tier is higher than another
export const isTierHigher = (tier1: SubscriptionTier, tier2: SubscriptionTier): boolean => {
  const tierOrder: SubscriptionTier[] = ['trainee', 'artist', 'supervisor', 'designer'];
  return tierOrder.indexOf(tier1) > tierOrder.indexOf(tier2);
};

// Get features user will lose when downgrading
export const getDowngradeWarnings = (fromTier: SubscriptionTier, toTier: SubscriptionTier): string[] => {
  const from = TIER_FEATURES[fromTier];
  const to = TIER_FEATURES[toTier];
  const warnings: string[] = [];

  if (from.offlineMode && !to.offlineMode) {
    warnings.push('Offline mode with full sync');
  }
  if (from.exportReports && !to.exportReports) {
    warnings.push('Export continuity reports');
  }
  if (from.personalTemplates && !to.personalTemplates) {
    warnings.push('Personal templates');
  }
  if (from.teamManagement && !to.teamManagement) {
    warnings.push('Team management');
  }
  if (from.canCreateProjects && !to.canCreateProjects) {
    warnings.push('Create & manage projects');
  }
  if (from.characterProgressionTracking && !to.characterProgressionTracking) {
    warnings.push('Character progression tracking');
  }
  if (from.shootingScheduleView && !to.shootingScheduleView) {
    warnings.push('Shooting schedule view');
  }
  if (from.teamPhotoStorage && !to.teamPhotoStorage) {
    warnings.push('Team photo storage');
  }
  if (from.desktopWebAccess && !to.desktopWebAccess) {
    warnings.push('Desktop web access');
  }
  if (from.preProductionBreakdown && !to.preProductionBreakdown) {
    warnings.push('Pre-production script breakdown');
  }
  if (from.characterDesignDocs && !to.characterDesignDocs) {
    warnings.push('Character design documentation');
  }
  if (from.exportProductionBooks && !to.exportProductionBooks) {
    warnings.push('Export production books');
  }
  if (from.budgetSchedulingTools && !to.budgetSchedulingTools) {
    warnings.push('Budget & scheduling tools');
  }

  // Photo limits
  if (from.maxPhotosPerProject > to.maxPhotosPerProject) {
    const fromLimit = from.maxPhotosPerProject === -1 ? 'Unlimited' : from.maxPhotosPerProject;
    const toLimit = to.maxPhotosPerProject === -1 ? 'Unlimited' : to.maxPhotosPerProject;
    warnings.push(`Photo limit reduced from ${fromLimit} to ${toLimit} per project`);
  }

  return warnings;
};

// Create default subscription data for new users
// In beta mode, all users get Designer tier with full access
export const createDefaultSubscription = (): SubscriptionData => ({
  tier: BETA_MODE ? 'designer' : 'trainee',
  status: BETA_MODE ? 'active' : null,
  billingPeriod: null,
});
