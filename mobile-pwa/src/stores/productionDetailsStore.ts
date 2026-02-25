import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ProductionInvoicingDetails } from '@/types';
import { createEmptyProductionInvoicingDetails } from '@/types';

interface ProductionDetailsState {
  // Per-project production details, keyed by project ID
  projectDetails: Record<string, ProductionInvoicingDetails>;

  // Actions
  getDetails: (projectId: string) => ProductionInvoicingDetails;
  updateDetails: (projectId: string, updates: Partial<ProductionInvoicingDetails>) => void;
  isComplete: (projectId: string) => boolean;
  getCompletionCount: (projectId: string) => { filled: number; total: number };
}

const REQUIRED_FIELDS: (keyof ProductionInvoicingDetails)[] = [
  'productionCompany',
  'productionAddress',
  'productionEmail',
  'accountsPayableContact',
  'accountsPayableEmail',
];

export const useProductionDetailsStore = create<ProductionDetailsState>()(
  persist(
    (set, get) => ({
      projectDetails: {},

      getDetails: (projectId: string) => {
        return get().projectDetails[projectId] || createEmptyProductionInvoicingDetails();
      },

      updateDetails: (projectId: string, updates: Partial<ProductionInvoicingDetails>) => {
        const current = get().projectDetails[projectId] || createEmptyProductionInvoicingDetails();
        set({
          projectDetails: {
            ...get().projectDetails,
            [projectId]: { ...current, ...updates },
          },
        });
      },

      isComplete: (projectId: string) => {
        const details = get().projectDetails[projectId];
        if (!details) return false;
        return REQUIRED_FIELDS.every(field => {
          const val = details[field];
          return typeof val === 'string' ? val.trim().length > 0 : !!val;
        });
      },

      getCompletionCount: (projectId: string) => {
        const details = get().projectDetails[projectId] || createEmptyProductionInvoicingDetails();
        const total = REQUIRED_FIELDS.length;
        const filled = REQUIRED_FIELDS.filter(field => {
          const val = details[field];
          return typeof val === 'string' ? val.trim().length > 0 : !!val;
        }).length;
        return { filled, total };
      },
    }),
    {
      name: 'hmk-production-details',
    }
  )
);
