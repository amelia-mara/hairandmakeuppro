// Department Mode System Configuration
// Department type determines the entire feature set and display of the app.
// Set at project creation, cannot be changed afterwards.

export type DepartmentType = 'hmu' | 'costume';

export const DEPARTMENT_OPTIONS: { value: DepartmentType; label: string; icon: string; description: string }[] = [
  { value: 'hmu', label: 'Hair & Makeup', icon: 'palette', description: 'H&MU breakdowns, continuity & budget' },
  { value: 'costume', label: 'Costume', icon: 'scissors', description: 'Costume tracking, 360 photos & budget' },
];

// Photo angle configuration per department
export type CostumePhotoCategory =
  | 'masterReference'
  | 'frontFull'
  | 'backFull'
  | 'leftSideFull'
  | 'rightSideFull'
  | 'detailJewellery'
  | 'detailAccessories'
  | 'detailShoes'
  | 'detailHeadwear'
  | 'closeupFastenings';

export const COSTUME_PHOTO_CATEGORIES: { key: CostumePhotoCategory; label: string; isMaster?: boolean }[] = [
  { key: 'masterReference', label: 'Master Reference', isMaster: true },
  { key: 'frontFull', label: 'Front Full Length' },
  { key: 'backFull', label: 'Back Full Length' },
  { key: 'leftSideFull', label: 'Left Side Full Length' },
  { key: 'rightSideFull', label: 'Right Side Full Length' },
  { key: 'detailJewellery', label: 'Detail: Jewellery' },
  { key: 'detailAccessories', label: 'Detail: Accessories' },
  { key: 'detailShoes', label: 'Detail: Shoes/Footwear' },
  { key: 'detailHeadwear', label: 'Detail: Headwear' },
  { key: 'closeupFastenings', label: 'Close-up: Fastenings/Buttons' },
];

// HMU photo angles (existing 4-slot grid)
export const HMU_PHOTO_ANGLES = ['front', 'left', 'right', 'back'] as const;

// Costume continuity fields (per character per scene)
export interface CostumeContinuityData {
  costumeItems: CostumeChecklistItem[];
  shoes: string;
  jewellery: string;
  accessories: string;
  hairPiecesWigs: string;
  continuityNotes: string;
  sceneChange: 'same' | 'change';
}

export interface CostumeChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  note?: string;
}

export const createDefaultCostumeContinuity = (): CostumeContinuityData => ({
  costumeItems: [],
  shoes: '',
  jewellery: '',
  accessories: '',
  hairPiecesWigs: '',
  continuityNotes: '',
  sceneChange: 'same',
});

// Costume budget categories
export const COSTUME_BUDGET_CATEGORIES = [
  'Costume Build',
  'Costume Hire',
  'Alterations',
  'Shoes',
  'Accessories',
  'Jewellery',
  'Hats/Headwear',
  'Undergarments',
  'Fabric/Materials',
  'Dry Cleaning',
  'Costume Breakdown',
  'Multiples',
] as const;

export type CostumeBudgetCategory = (typeof COSTUME_BUDGET_CATEGORIES)[number];

// HMU budget categories (existing)
export const HMU_BUDGET_CATEGORIES = [
  'Kit Supplies',
  'Consumables',
  'Transportation',
  'Equipment',
  'Other',
] as const;

// Department-specific labels for shared UI elements
export const DEPARTMENT_LABELS: Record<DepartmentType, {
  departmentName: string;
  departmentShort: string;
  callLabel: string;
  dashboardTitle: string;
  breakdownTitle: string;
  budgetTitle: string;
  continuityTitle: string;
  productsLabel: string;
  productsPlaceholder: string;
  changesLabel: string;
  changesPlaceholder: string;
  applicationTimeLabel: string;
}> = {
  hmu: {
    departmentName: 'Hair & Makeup',
    departmentShort: 'H&MU',
    callLabel: 'H&MU Call',
    dashboardTitle: 'H&MU Dashboard',
    breakdownTitle: 'H&MU Breakdown',
    budgetTitle: 'H&MU Budget',
    continuityTitle: 'Continuity Tracker',
    productsLabel: 'Products Used',
    productsPlaceholder: 'e.g., MAC Ruby Woo, NARS Orgasm blush...',
    changesLabel: 'Changes from Master',
    changesPlaceholder: "What's different from the master look for this scene...",
    applicationTimeLabel: 'Application Time',
  },
  costume: {
    departmentName: 'Costume',
    departmentShort: 'Costume',
    callLabel: 'Costume Call',
    dashboardTitle: 'Costume Dashboard',
    breakdownTitle: 'Costume Breakdown',
    budgetTitle: 'Costume Budget',
    continuityTitle: 'Costume Continuity',
    productsLabel: 'Costume Items',
    productsPlaceholder: 'e.g., Blue dress, Brown boots, Gold necklace...',
    changesLabel: 'Changes from Previous',
    changesPlaceholder: 'What costume changes occur in this scene...',
    applicationTimeLabel: 'Fitting Time',
  },
};

// Helper to get budget categories by department
export function getBudgetCategoriesForDepartment(department: DepartmentType): readonly string[] {
  return department === 'costume' ? COSTUME_BUDGET_CATEGORIES : HMU_BUDGET_CATEGORIES;
}

// Helper to get labels for department
export function getDepartmentLabels(department: DepartmentType) {
  return DEPARTMENT_LABELS[department];
}
