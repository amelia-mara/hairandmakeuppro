/**
 * Project Service — Supabase CRUD for the project list.
 *
 * Creates projects via the create_project RPC and loads the
 * user's project list from the project_members join table.
 */

import { supabase } from '@/lib/supabase';

// ---------- Types ----------

export interface SupabaseProject {
  id: string;
  name: string;
  production_type: string;
  department: string;
  invite_code: string;
  created_by: string;
  created_at: string;
  has_prep_access?: boolean;
}

// ---------- Create ----------

export async function createProjectInSupabase(
  name: string,
  productionType: string,
  department: 'hmu' | 'costume' = 'hmu',
): Promise<{ project: SupabaseProject | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('create_project', {
      project_name: name,
      production_type_input: productionType,
      owner_role_input: 'designer',
      department_input: department,
      has_prep_access_input: true,
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    return {
      project: {
        id: data.id,
        name: data.name,
        production_type: data.production_type,
        department: data.department || 'hmu',
        invite_code: data.invite_code,
        created_by: data.created_by,
        created_at: data.created_at || new Date().toISOString(),
      },
      error: null,
    };
  } catch (err) {
    console.error('[ProjectService] create failed:', err);
    return { project: null, error: err as Error };
  }
}

// ---------- Delete ----------

export async function deleteProjectFromSupabase(
  projectId: string,
): Promise<{ error: Error | null }> {
  try {
    // Remove project membership first (RLS may block direct project delete)
    const { error: memberError } = await supabase
      .from('project_members')
      .delete()
      .eq('project_id', projectId);
    if (memberError) console.warn('[ProjectService] member cleanup:', memberError);

    // Delete the project itself
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId);
    if (error) throw error;

    return { error: null };
  } catch (err) {
    console.error('[ProjectService] delete failed:', err);
    return { error: err as Error };
  }
}

// ---------- Load user projects ----------

export async function loadUserProjects(
  userId: string,
): Promise<{ projects: SupabaseProject[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('project_members')
      .select(`
        role,
        is_owner,
        joined_at,
        projects (*)
      `)
      .eq('user_id', userId)
      .order('joined_at', { ascending: false });

    if (error) throw error;

    const projects: SupabaseProject[] = (data || [])
      .map((pm: any) => pm.projects)
      .filter(Boolean);

    return { projects, error: null };
  } catch (err) {
    console.error('[ProjectService] loadUserProjects failed:', err);
    return { projects: [], error: err as Error };
  }
}
