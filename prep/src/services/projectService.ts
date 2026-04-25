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
  /** When set, the project has been soft-deleted by the owner from the
   *  mobile app. Hidden from the prep project list. */
  pending_deletion_at?: string | null;
  scene_count?: number;
  character_count?: number;
  script_filename?: string;
  /**
   * Timestamp of the most recent activity on the project we can observe from
   * tables the hub already queries. Currently the latest active
   * `script_uploads.created_at`; falls back to `projects.created_at` when no
   * script has been uploaded.
   */
  last_updated_at?: string;
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
      .filter(Boolean)
      // Hide soft-deleted projects so a deletion in mobile (which sets
      // `pending_deletion_at` instead of hard-deleting) propagates to
      // prep on the next hydrate. The 48-hour grace period is for the
      // owner-app to download things before the row is removed
      // permanently — prep's job is just not to show them.
      .filter((p: SupabaseProject) => !p.pending_deletion_at);

    if (projects.length === 0) {
      return { projects, error: null };
    }

    // Fetch scene/character counts from the active script upload per project.
    // The ProjectHub cards show these counts and need them before the user
    // opens a project (useProjectSync only populates them on project open).
    const projectIds = projects.map((p) => p.id);
    const { data: uploads, error: uploadsError } = await supabase
      .from('script_uploads')
      .select('project_id, scene_count, character_count, file_name, created_at')
      .in('project_id', projectIds)
      .eq('is_active', true);

    if (uploadsError) {
      console.warn('[ProjectService] failed to load script_uploads counts:', uploadsError);
    } else if (uploads) {
      const byProject = new Map<string, {
        scenes: number;
        characters: number;
        filename?: string;
        createdAt?: string;
      }>();
      for (const u of uploads) {
        byProject.set(u.project_id as string, {
          scenes: (u.scene_count as number) || 0,
          characters: (u.character_count as number) || 0,
          filename: (u.file_name as string) || undefined,
          createdAt: (u.created_at as string) || undefined,
        });
      }
      for (const p of projects) {
        const c = byProject.get(p.id);
        if (c) {
          p.scene_count = c.scenes;
          p.character_count = c.characters;
          p.script_filename = c.filename;
          p.last_updated_at = c.createdAt ?? p.created_at;
        } else {
          p.last_updated_at = p.created_at;
        }
      }
    }

    return { projects, error: null };
  } catch (err) {
    console.error('[ProjectService] loadUserProjects failed:', err);
    return { projects: [], error: err as Error };
  }
}
