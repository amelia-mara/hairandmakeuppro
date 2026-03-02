// Types (app-level domain types)
export * from './types';
export * from './types/subscription';

// Supabase DB types (namespaced to avoid collisions with app-level types)
export { type Database, type Json } from './types/supabase';
export type {
  User as DbUser,
  Project as DbProject,
  ProjectMember as DbProjectMember,
  Character as DbCharacter,
  Scene as DbScene,
  Look as DbLook,
  ContinuityEvent as DbContinuityEvent,
  Photo as DbPhoto,
  ScheduleData as DbScheduleData,
  Timesheet as DbTimesheet,
  CallSheetData as DbCallSheetData,
  ScriptUpload as DbScriptUpload,
} from './types/supabase';

// Services
export { supabase, isSupabaseConfigured, getCurrentUser, getCurrentSession } from './services/supabaseClient';
export * from './services/supabaseAuth';
export * from './services/supabaseProjects';
export * from './services/supabaseStorage';
export * from './services/aiService';

// Utils
export * from './utils/scriptParser';
export * from './utils/scheduleParser';
export * from './utils/exportUtils';
export * from './utils/helpers';
export * from './utils/safeJson';
