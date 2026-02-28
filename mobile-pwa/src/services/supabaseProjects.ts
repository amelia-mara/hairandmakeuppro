import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';

type Project = Database['public']['Tables']['projects']['Row'];
type ProjectMember = Database['public']['Tables']['project_members']['Row'];
type Character = Database['public']['Tables']['characters']['Row'];
type Scene = Database['public']['Tables']['scenes']['Row'];
type Look = Database['public']['Tables']['looks']['Row'];

export interface ProjectWithRole extends Project {
  role: ProjectMember['role'];
  is_owner: boolean;
  owner_name?: string;
}

// Generate a unique invite code
function generateInviteCode(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const alphanumeric = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  // First 3 characters: letters only
  for (let i = 0; i < 3; i++) {
    code += letters[Math.floor(Math.random() * letters.length)];
  }
  code += '-';
  // Last 4 characters: letters + digits
  for (let i = 0; i < 4; i++) {
    code += alphanumeric[Math.floor(Math.random() * alphanumeric.length)];
  }
  return code;
}

// Create a new project
export async function createProject(
  name: string,
  productionType: string,
  userId: string,
  ownerRole: ProjectMember['role'] = 'designer'
): Promise<{ project: Project | null; inviteCode: string | null; error: Error | null }> {
  try {
    const inviteCode = generateInviteCode();

    // Create the project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        name,
        production_type: productionType,
        invite_code: inviteCode,
        created_by: userId,
      })
      .select()
      .single();

    if (projectError) throw projectError;

    // Add creator as owner with their selected role
    const { error: memberError } = await supabase
      .from('project_members')
      .insert({
        project_id: project.id,
        user_id: userId,
        role: ownerRole,
        is_owner: true,
      });

    if (memberError) {
      // Rollback project creation
      await supabase.from('projects').delete().eq('id', project.id);
      throw memberError;
    }

    return { project, inviteCode, error: null };
  } catch (error) {
    return { project: null, inviteCode: null, error: error as Error };
  }
}

// Look up a project by invite code (without adding as member)
export async function getProjectByInviteCode(
  inviteCode: string
): Promise<{ project: Project | null; error: Error | null }> {
  try {
    const { data: rpcResult, error: rpcError } = await supabase
      .rpc('lookup_project_by_invite_code', {
        invite_code_input: inviteCode.toUpperCase(),
      });

    if (rpcError) throw rpcError;

    if (rpcResult?.error) {
      throw new Error(rpcResult.error);
    }

    const project = {
      id: rpcResult.id,
      name: rpcResult.name,
      production_type: rpcResult.production_type,
      invite_code: rpcResult.invite_code,
    } as Project;

    return { project, error: null };
  } catch (error) {
    return { project: null, error: error as Error };
  }
}

// Join a project by invite code
// Uses the SECURITY DEFINER RPC function to bypass RLS
export async function joinProject(
  inviteCode: string,
  _userId: string,
  role: ProjectMember['role'] = 'floor'
): Promise<{ project: Project | null; error: Error | null }> {
  try {
    const { data: rpcResult, error: rpcError } = await supabase
      .rpc('join_project_by_invite_code', {
        invite_code_input: inviteCode.toUpperCase(),
        role_input: role,
      });

    if (rpcError) throw rpcError;

    if (rpcResult?.error) {
      throw new Error(rpcResult.error);
    }

    const project = {
      id: rpcResult.project_id,
      name: rpcResult.project_name,
      production_type: rpcResult.production_type,
      invite_code: rpcResult.invite_code,
      created_at: rpcResult.created_at,
    } as Project;
    return { project, error: null };
  } catch (error) {
    return { project: null, error: error as Error };
  }
}

// Get all projects for a user
export async function getUserProjects(
  userId: string
): Promise<{ projects: ProjectWithRole[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('project_members')
      .select(`
        role,
        is_owner,
        joined_at,
        projects (*, users:created_by (name))
      `)
      .eq('user_id', userId)
      .order('joined_at', { ascending: false });

    if (error) throw error;

    const projects: ProjectWithRole[] = (data || []).map((pm: any) => ({
      ...pm.projects,
      role: pm.role,
      is_owner: pm.is_owner,
      owner_name: pm.projects?.users?.name || undefined,
    }));

    // Remove the nested users object from the project data
    for (const p of projects) {
      delete (p as unknown as Record<string, unknown>).users;
    }

    return { projects, error: null };
  } catch (error) {
    return { projects: [], error: error as Error };
  }
}

// Get full project data (scenes, characters, looks, documents)
export async function getProjectData(projectId: string): Promise<{
  scenes: Scene[];
  characters: Character[];
  looks: Look[];
  sceneCharacters: { scene_id: string; character_id: string }[];
  lookScenes: { look_id: string; scene_number: string }[];
  scheduleData: any[];
  callSheetData: any[];
  scriptData: any[];
  error: Error | null;
}> {
  try {
    // Phase 1: Fetch project-level tables in parallel (including documents)
    const [scenesRes, charactersRes, looksRes, scheduleRes, callSheetsRes, scriptRes] = await Promise.all([
      supabase.from('scenes').select('*').eq('project_id', projectId).order('scene_number'),
      supabase.from('characters').select('*').eq('project_id', projectId).order('name'),
      supabase.from('looks').select('*').eq('project_id', projectId),
      supabase.from('schedule_data').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(1),
      supabase.from('call_sheet_data').select('*').eq('project_id', projectId).order('production_day'),
      supabase.from('script_uploads').select('*').eq('project_id', projectId).eq('is_active', true).limit(1),
    ]);

    if (scenesRes.error) throw scenesRes.error;
    if (charactersRes.error) throw charactersRes.error;
    if (looksRes.error) throw looksRes.error;

    const scenes = scenesRes.data || [];
    const looks = looksRes.data || [];

    // Phase 2: Fetch junction tables filtered by the scene/look IDs we found
    const sceneIds = scenes.map(s => s.id);
    const lookIds = looks.map(l => l.id);

    const [sceneCharsRes, lookScenesRes] = await Promise.all([
      sceneIds.length > 0
        ? supabase.from('scene_characters').select('scene_id, character_id').in('scene_id', sceneIds)
        : Promise.resolve({ data: [], error: null }),
      lookIds.length > 0
        ? supabase.from('look_scenes').select('look_id, scene_number').in('look_id', lookIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    return {
      scenes,
      characters: charactersRes.data || [],
      looks,
      sceneCharacters: sceneCharsRes.data || [],
      lookScenes: lookScenesRes.data || [],
      scheduleData: scheduleRes.data || [],
      callSheetData: callSheetsRes.data || [],
      scriptData: scriptRes.data || [],
      error: null,
    };
  } catch (error) {
    return {
      scenes: [],
      characters: [],
      looks: [],
      sceneCharacters: [],
      lookScenes: [],
      scheduleData: [],
      callSheetData: [],
      scriptData: [],
      error: error as Error,
    };
  }
}

// Update project status
export async function updateProjectStatus(
  projectId: string,
  status: Project['status']
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('projects')
      .update({ status })
      .eq('id', projectId);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}

// Regenerate invite code (owner only)
export async function regenerateInviteCode(
  projectId: string
): Promise<{ inviteCode: string | null; error: Error | null }> {
  try {
    const inviteCode = generateInviteCode();

    const { error } = await supabase
      .from('projects')
      .update({ invite_code: inviteCode })
      .eq('id', projectId);

    if (error) throw error;
    return { inviteCode, error: null };
  } catch (error) {
    return { inviteCode: null, error: error as Error };
  }
}

// Remove a member from project
export async function removeMember(
  projectId: string,
  userId: string
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}

// Update member role
export async function updateMemberRole(
  projectId: string,
  userId: string,
  role: ProjectMember['role']
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('project_members')
      .update({ role })
      .eq('project_id', projectId)
      .eq('user_id', userId);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}

// Get project members
export async function getProjectMembers(
  projectId: string
): Promise<{ members: (ProjectMember & { user: { name: string; email: string } })[]; error: Error | null }> {
  try {
    // Use a left join (no !inner) so members are still returned even if the
    // "Project members can view teammate profiles" RLS policy on the users
    // table hasn't been applied yet.  Without that policy a user can only
    // SELECT their own row in `users`, and INNER JOIN would silently drop
    // every other team member from the result set.
    const { data, error } = await supabase
      .from('project_members')
      .select(`
        *,
        users (name, email)
      `)
      .eq('project_id', projectId)
      .order('joined_at');

    if (error) throw error;

    const members = (data || []).map((pm: any) => ({
      ...pm,
      user: {
        name: pm.users?.name || pm.user_id.slice(0, 8),
        email: pm.users?.email || '',
      },
    }));

    return { members, error: null };
  } catch (error) {
    return { members: [], error: error as Error };
  }
}

// Save scenes to database
export async function saveScenes(
  projectId: string,
  scenes: Omit<Scene, 'id' | 'created_at'>[]
): Promise<{ error: Error | null }> {
  try {
    // Upsert scenes (insert or update based on project_id + scene_number)
    const { error } = await supabase
      .from('scenes')
      .upsert(
        scenes.map(s => ({ ...s, project_id: projectId })),
        { onConflict: 'project_id,scene_number' }
      );

    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}

// Save characters to database
export async function saveCharacters(
  projectId: string,
  characters: Omit<Character, 'created_at'>[]
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('characters')
      .upsert(
        characters.map(c => ({ ...c, project_id: projectId })),
        { onConflict: 'id' }
      );

    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}

// Save looks to database
export async function saveLooks(
  projectId: string,
  looks: Omit<Look, 'created_at'>[],
  lookScenes: { look_id: string; scene_number: string }[]
): Promise<{ error: Error | null }> {
  try {
    // Save looks
    const { error: lookError } = await supabase
      .from('looks')
      .upsert(
        looks.map(l => ({ ...l, project_id: projectId })),
        { onConflict: 'id' }
      );

    if (lookError) throw lookError;

    // Delete existing look_scenes and re-insert
    const lookIds = looks.map(l => l.id);
    await supabase.from('look_scenes').delete().in('look_id', lookIds);

    if (lookScenes.length > 0) {
      const { error: lsError } = await supabase
        .from('look_scenes')
        .insert(lookScenes);

      if (lsError) throw lsError;
    }

    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}

// Save scene-character relationships
export async function saveSceneCharacters(
  sceneCharacters: { scene_id: string; character_id: string }[]
): Promise<{ error: Error | null }> {
  try {
    if (sceneCharacters.length === 0) return { error: null };

    // Get unique scene IDs
    const sceneIds = [...new Set(sceneCharacters.map(sc => sc.scene_id))];

    // Delete existing relationships for these scenes
    await supabase.from('scene_characters').delete().in('scene_id', sceneIds);

    // Insert new relationships
    const { error } = await supabase
      .from('scene_characters')
      .insert(sceneCharacters);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}

// Grace period (in hours) before a pending deletion becomes permanent
export const DELETION_GRACE_PERIOD_HOURS = 48;

// Soft-delete a project (owner only)
// Sets pending_deletion_at instead of immediately removing data, giving synced
// team members a 48-hour window to download documents.
// Falls back to hard delete if the pending_deletion_at column hasn't been migrated yet.
export async function deleteProject(
  projectId: string,
  userId: string
): Promise<{ error: Error | null }> {
  try {
    // First verify the user is the owner
    const { data: membership, error: memberError } = await supabase
      .from('project_members')
      .select('is_owner')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .single();

    if (memberError) throw new Error('Failed to verify project ownership');
    if (!membership?.is_owner) throw new Error('Only project owners can delete projects');

    // Try soft-delete first (set pending_deletion_at to start the grace period)
    const { error: updateError } = await supabase
      .from('projects')
      .update({ pending_deletion_at: new Date().toISOString() })
      .eq('id', projectId);

    if (updateError) {
      // If pending_deletion_at column doesn't exist yet, fall back to hard delete
      const isSchemaError = updateError.message?.includes('schema cache') ||
        updateError.message?.includes('pending_deletion_at') ||
        updateError.code === 'PGRST204';
      if (isSchemaError) {
        return finalizeProjectDeletion(projectId, userId);
      }
      throw updateError;
    }

    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}

// Permanently delete a project and all related data (owner only)
// Called after the grace period has elapsed.
export async function finalizeProjectDeletion(
  projectId: string,
  userId: string
): Promise<{ error: Error | null }> {
  try {
    // Verify the user is the owner
    const { data: membership, error: memberError } = await supabase
      .from('project_members')
      .select('is_owner')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .single();

    if (memberError) throw new Error('Failed to verify project ownership');
    if (!membership?.is_owner) throw new Error('Only project owners can delete projects');

    // Delete in order to respect foreign key constraints
    const { data: scenes } = await supabase
      .from('scenes')
      .select('id')
      .eq('project_id', projectId);
    const sceneIds = scenes?.map(s => s.id) || [];

    const { data: looks } = await supabase
      .from('looks')
      .select('id')
      .eq('project_id', projectId);
    const lookIds = looks?.map(l => l.id) || [];

    if (sceneIds.length > 0) {
      await supabase.from('scene_characters').delete().in('scene_id', sceneIds);
    }
    if (lookIds.length > 0) {
      await supabase.from('look_scenes').delete().in('look_id', lookIds);
    }

    await supabase.from('looks').delete().eq('project_id', projectId);
    await supabase.from('characters').delete().eq('project_id', projectId);
    await supabase.from('scenes').delete().eq('project_id', projectId);
    await supabase.from('project_members').delete().eq('project_id', projectId);

    const { error: deleteError } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId);

    if (deleteError) throw deleteError;

    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}

// Check if a pending deletion's grace period has elapsed
export function isDeletionGracePeriodExpired(pendingDeletionAt: string | Date): boolean {
  const deletionTime = new Date(pendingDeletionAt);
  const expiresAt = new Date(deletionTime.getTime() + DELETION_GRACE_PERIOD_HOURS * 60 * 60 * 1000);
  return new Date() >= expiresAt;
}

// Calculate hours remaining in the grace period
export function hoursUntilDeletion(pendingDeletionAt: string | Date): number {
  const deletionTime = new Date(pendingDeletionAt);
  const expiresAt = new Date(deletionTime.getTime() + DELETION_GRACE_PERIOD_HOURS * 60 * 60 * 1000);
  const remaining = expiresAt.getTime() - new Date().getTime();
  return Math.max(0, Math.ceil(remaining / (1000 * 60 * 60)));
}

// Leave a project (for non-owners)
export async function leaveProject(
  projectId: string,
  userId: string
): Promise<{ error: Error | null }> {
  try {
    // Verify user is not the owner
    const { data: membership, error: memberError } = await supabase
      .from('project_members')
      .select('is_owner')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .single();

    if (memberError) throw new Error('Failed to verify membership');
    if (membership?.is_owner) throw new Error('Owners cannot leave their own project. Transfer ownership or delete the project instead.');

    // Remove the membership
    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}

// ============================================================================
// Direct project data save — bypasses the sync pipeline entirely.
// Called once after script/schedule upload to guarantee data reaches
// Supabase before the user can navigate away.
// ============================================================================

import * as supabaseStorage from './supabaseStorage';

interface SaveProjectDataParams {
  projectId: string;
  userId: string | null;
  scenes: {
    id: string;
    scene_number: string;
    int_ext: string | null;
    location: string | null;
    time_of_day: string | null;
    synopsis: string | null;
    script_content: string | null;
    shooting_day: number | string | null;
    is_complete: boolean;
  }[];
  characters?: {
    id: string;
    name: string;
    initials: string;
    avatar_colour: string;
  }[];
  sceneCharacters?: { scene_id: string; character_id: string }[];
  schedule?: {
    id: string;
    rawText: string | null;
    castList: unknown;
    days: unknown;
    status: string;
    pdfDataUri?: string;
  } | null;
  scriptPdfDataUri?: string;
}

export async function saveInitialProjectData(params: SaveProjectDataParams): Promise<{ error: Error | null }> {
  const { projectId, userId, scenes, characters, sceneCharacters, schedule, scriptPdfDataUri } = params;

  try {
    // 1. Save scenes
    if (scenes.length > 0) {
      // Clear existing scenes to avoid unique constraint conflicts on scene_number
      await supabase
        .from('scenes')
        .delete()
        .eq('project_id', projectId);

      const dbScenes = scenes.map(s => ({
        id: s.id,
        project_id: projectId,
        scene_number: s.scene_number,
        int_ext: s.int_ext,
        location: s.location,
        time_of_day: s.time_of_day,
        synopsis: s.synopsis,
        script_content: s.script_content,
        shooting_day: s.shooting_day,
        is_complete: s.is_complete,
      }));

      const { error: sceneError } = await supabase
        .from('scenes')
        .upsert(dbScenes, { onConflict: 'id' });
      if (sceneError) {
        console.error('[SAVE] scenes failed:', sceneError);
        throw sceneError;
      }
    }

    // 1b. Save characters (if provided)
    if (characters && characters.length > 0) {
      const { error: charError } = await supabase
        .from('characters')
        .upsert(
          characters.map(c => ({
            id: c.id,
            project_id: projectId,
            name: c.name,
            initials: c.initials,
            avatar_colour: c.avatar_colour,
          })),
          { onConflict: 'id' }
        );
      if (charError) {
        console.error('[SAVE] characters failed:', charError);
        // Don't throw — characters are supplementary, scenes are primary
      }
    }

    // 1c. Save scene_characters junction (if provided)
    if (sceneCharacters && sceneCharacters.length > 0) {
      const sceneIds = [...new Set(sceneCharacters.map(sc => sc.scene_id))];
      // Clear existing first
      await supabase.from('scene_characters').delete().in('scene_id', sceneIds);
      const { error: scError } = await supabase
        .from('scene_characters')
        .insert(sceneCharacters);
      if (scError) {
        console.error('[SAVE] scene_characters failed:', scError);
      }
    }

    // 2. Save schedule data
    if (schedule) {
      const { error: scheduleError } = await supabase
        .from('schedule_data')
        .upsert({
          id: schedule.id,
          project_id: projectId,
          raw_pdf_text: schedule.rawText || null,
          cast_list: schedule.castList as Database['public']['Tables']['schedule_data']['Row']['cast_list'],
          days: schedule.days as Database['public']['Tables']['schedule_data']['Row']['days'],
          status: schedule.status === 'complete' ? 'complete' : 'pending',
        }, { onConflict: 'id' });
      if (scheduleError) {
        console.error('[SAVE] schedule_data failed:', scheduleError);
        throw scheduleError;
      }

      // Upload schedule PDF to storage
      if (schedule.pdfDataUri && schedule.pdfDataUri.startsWith('data:')) {
        const { path, error: uploadError } = await supabaseStorage.uploadBase64Document(
          projectId, 'schedules', schedule.pdfDataUri
        );
        if (!uploadError && path) {
          await supabase
            .from('schedule_data')
            .update({ storage_path: path })
            .eq('id', schedule.id);
        }
      }
    }

    // 3. Upload script PDF to storage + create script_uploads record
    if (scriptPdfDataUri && scriptPdfDataUri.startsWith('data:')) {
      const { path, error: uploadError } = await supabaseStorage.uploadBase64Document(
        projectId, 'scripts', scriptPdfDataUri
      );
      if (!uploadError && path) {
        // Deactivate previous uploads
        await supabase
          .from('script_uploads')
          .update({ is_active: false })
          .eq('project_id', projectId)
          .eq('is_active', true);

        // Create new record
        const base64Length = scriptPdfDataUri.split(',')[1]?.length || 0;
        const fileSize = Math.round(base64Length * 0.75);
        const { error: dbError } = await supabase
          .from('script_uploads')
          .insert({
            project_id: projectId,
            storage_path: path,
            file_name: 'script.pdf',
            file_size: fileSize,
            is_active: true,
            status: 'uploaded',
            uploaded_by: userId,
            scene_count: scenes.length,
          });
        if (dbError) {
          console.error('[SAVE] script_uploads failed:', dbError);
        }
      }
    }

    return { error: null };
  } catch (error) {
    console.error('[SAVE] saveInitialProjectData failed:', error);
    return { error: error as Error };
  }
}
