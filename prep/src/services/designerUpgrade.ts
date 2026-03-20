/**
 * Designer Upgrade Service
 *
 * When a user upgrades from Supervisor to Designer, all projects they
 * own become available in Prep immediately. has_prep_access is set to
 * true on all their projects.
 */

import { supabase } from '@/lib/supabase';

/**
 * Upgrade a user to Designer tier and unlock Prep for all owned projects.
 */
export async function upgradeToDesigner(userId: string): Promise<void> {
  // Update user tier
  const { error: tierError } = await supabase
    .from('users')
    .update({ tier: 'designer' })
    .eq('id', userId);

  if (tierError) throw tierError;

  // Unlock Prep for all owned projects
  const { data: ownedProjects, error: fetchError } = await supabase
    .from('project_members')
    .select('project_id')
    .eq('user_id', userId)
    .eq('is_owner', true);

  if (fetchError) throw fetchError;

  if (ownedProjects && ownedProjects.length > 0) {
    const projectIds = ownedProjects.map(p => p.project_id);
    const { error: updateError } = await supabase
      .from('projects')
      .update({ has_prep_access: true })
      .in('id', projectIds);

    if (updateError) throw updateError;
    console.log(`[DesignerUpgrade] Unlocked Prep for ${projectIds.length} projects`);
  }
}

/**
 * Check if a user has Designer tier.
 */
export async function isDesigner(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('users')
    .select('tier')
    .eq('id', userId)
    .single();

  if (error) return false;
  return data?.tier === 'designer';
}

/**
 * Ensure a specific project has prep access enabled.
 * Called when creating a project from Prep (always has_prep_access=true).
 */
export async function ensurePrepAccess(projectId: string): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({ has_prep_access: true })
    .eq('id', projectId);

  if (error) throw error;
}
