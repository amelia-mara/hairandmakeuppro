import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { BillingDetails, BankDetails, VATSettings } from '@/types';
import { createEmptyBillingDetails } from '@/types';

interface BillingState {
  // Billing details (tied to user, persists across projects)
  billingDetails: BillingDetails;

  // Loading state
  isLoading: boolean;
  isSaving: boolean;
  lastError: string | null;

  // Actions - Update entire billing details
  setBillingDetails: (details: BillingDetails) => void;

  // Actions - Update individual fields
  updatePersonalInfo: (updates: Partial<Pick<BillingDetails, 'fullName' | 'businessName' | 'address' | 'phone' | 'email'>>) => void;
  updateBankDetails: (updates: Partial<BankDetails>) => void;
  updatePaymentTerms: (terms: string) => void;
  updateVATSettings: (updates: Partial<VATSettings>) => void;

  // Actions - Toggle VAT registered status
  toggleVATRegistered: () => void;

  // Actions - Reset to defaults
  resetBillingDetails: () => void;

  // Computed - Check if billing details are complete for invoicing
  isBillingComplete: () => boolean;

  // Computed - Get validation errors
  getValidationErrors: () => string[];
}

export const useBillingStore = create<BillingState>()(
  persist(
    (set, get) => ({
      billingDetails: createEmptyBillingDetails(),
      isLoading: false,
      isSaving: false,
      lastError: null,

      setBillingDetails: (details) => {
        set({
          billingDetails: {
            ...details,
            lastUpdated: new Date(),
          },
          lastError: null,
        });
      },

      updatePersonalInfo: (updates) => {
        set((state) => ({
          billingDetails: {
            ...state.billingDetails,
            ...updates,
            lastUpdated: new Date(),
          },
          lastError: null,
        }));
      },

      updateBankDetails: (updates) => {
        set((state) => ({
          billingDetails: {
            ...state.billingDetails,
            bankDetails: {
              ...state.billingDetails.bankDetails,
              ...updates,
            },
            lastUpdated: new Date(),
          },
          lastError: null,
        }));
      },

      updatePaymentTerms: (terms) => {
        set((state) => ({
          billingDetails: {
            ...state.billingDetails,
            paymentTerms: terms,
            lastUpdated: new Date(),
          },
          lastError: null,
        }));
      },

      updateVATSettings: (updates) => {
        set((state) => ({
          billingDetails: {
            ...state.billingDetails,
            vatSettings: {
              ...state.billingDetails.vatSettings,
              ...updates,
            },
            lastUpdated: new Date(),
          },
          lastError: null,
        }));
      },

      toggleVATRegistered: () => {
        set((state) => ({
          billingDetails: {
            ...state.billingDetails,
            vatSettings: {
              ...state.billingDetails.vatSettings,
              isVATRegistered: !state.billingDetails.vatSettings.isVATRegistered,
            },
            lastUpdated: new Date(),
          },
          lastError: null,
        }));
      },

      resetBillingDetails: () => {
        set({
          billingDetails: createEmptyBillingDetails(),
          lastError: null,
        });
      },

      isBillingComplete: () => {
        const { billingDetails } = get();
        const { bankDetails, vatSettings } = billingDetails;

        // Required fields for invoicing
        const hasPersonalInfo = !!(
          billingDetails.fullName &&
          billingDetails.address &&
          billingDetails.email
        );

        const hasBankDetails = !!(
          bankDetails.accountName &&
          bankDetails.sortCode &&
          bankDetails.accountNumber
        );

        // VAT number required only if VAT registered
        const hasVATInfo = !vatSettings.isVATRegistered || !!vatSettings.vatNumber;

        return hasPersonalInfo && hasBankDetails && hasVATInfo;
      },

      getValidationErrors: () => {
        const { billingDetails } = get();
        const { bankDetails, vatSettings } = billingDetails;
        const errors: string[] = [];

        // Personal info validation
        if (!billingDetails.fullName) {
          errors.push('Full name is required');
        }
        if (!billingDetails.address) {
          errors.push('Address is required');
        }
        if (!billingDetails.email) {
          errors.push('Email is required');
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billingDetails.email)) {
          errors.push('Email format is invalid');
        }

        // Bank details validation
        if (!bankDetails.accountName) {
          errors.push('Bank account name is required');
        }
        if (!bankDetails.sortCode) {
          errors.push('Sort code is required');
        } else if (!/^\d{2}-?\d{2}-?\d{2}$/.test(bankDetails.sortCode.replace(/\s/g, ''))) {
          errors.push('Sort code should be 6 digits (e.g., 12-34-56)');
        }
        if (!bankDetails.accountNumber) {
          errors.push('Account number is required');
        } else if (!/^\d{8}$/.test(bankDetails.accountNumber.replace(/\s/g, ''))) {
          errors.push('Account number should be 8 digits');
        }

        // VAT validation (only if registered)
        if (vatSettings.isVATRegistered && !vatSettings.vatNumber) {
          errors.push('VAT number is required when VAT registered');
        }
        if (vatSettings.vatRate < 0 || vatSettings.vatRate > 100) {
          errors.push('VAT rate must be between 0 and 100');
        }

        return errors;
      },
    }),
    {
      name: 'checks-happy-billing',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        billingDetails: state.billingDetails,
      }),
    }
  )
);

// Helper function to format sort code for display (XX-XX-XX)
export const formatSortCode = (sortCode: string): string => {
  const digits = sortCode.replace(/\D/g, '');
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 6)}`;
};

// Helper function to format account number for display
export const formatAccountNumber = (accountNumber: string): string => {
  return accountNumber.replace(/\D/g, '').slice(0, 8);
};
