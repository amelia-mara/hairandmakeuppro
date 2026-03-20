-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 016: Add budget_data, script_tags, and script_revisions tables
-- These store Prep-specific data that was previously only in localStorage.
-- Safe to run on a live database — all statements use IF NOT EXISTS.
-- ══════════════════════════════════════════════════════════════════════════════


-- ── 1. budget_data — stores full budget state per project as JSONB ──────────
-- One row per project. The JSONB column holds all categories, line items,
-- expenses, receipts, and settings. This avoids creating 5+ relational tables
-- for a feature that only Prep uses; the mobile app reads but doesn't write.

CREATE TABLE IF NOT EXISTS public.budget_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  project_info JSONB NOT NULL DEFAULT '{}',
  categories JSONB NOT NULL DEFAULT '[]',
  expenses JSONB NOT NULL DEFAULT '[]',
  receipts JSONB NOT NULL DEFAULT '[]',
  is_ltd BOOLEAN NOT NULL DEFAULT false,
  currency TEXT NOT NULL DEFAULT 'GBP',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id)
);

ALTER TABLE public.budget_data ENABLE ROW LEVEL SECURITY;

-- RLS: project members can read/write budget data
CREATE POLICY "Members can view budget"
  ON public.budget_data FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_members.project_id = budget_data.project_id
      AND project_members.user_id = auth.uid()
  ));

CREATE POLICY "Members can insert budget"
  ON public.budget_data FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_members.project_id = budget_data.project_id
      AND project_members.user_id = auth.uid()
  ));

CREATE POLICY "Members can update budget"
  ON public.budget_data FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_members.project_id = budget_data.project_id
      AND project_members.user_id = auth.uid()
  ));

CREATE POLICY "Members can delete budget"
  ON public.budget_data FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_members.project_id = budget_data.project_id
      AND project_members.user_id = auth.uid()
  ));


-- ── 2. script_tags — stores script breakdown tags per project ───────────────
-- Tags mark specific items in the script (props, vehicles, sfx, etc.)
-- and are keyed by scene + character. Stored as JSONB array per project
-- to keep it simple — one row per project.

CREATE TABLE IF NOT EXISTS public.script_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  tags JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id)
);

ALTER TABLE public.script_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view tags"
  ON public.script_tags FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_members.project_id = script_tags.project_id
      AND project_members.user_id = auth.uid()
  ));

CREATE POLICY "Members can insert tags"
  ON public.script_tags FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_members.project_id = script_tags.project_id
      AND project_members.user_id = auth.uid()
  ));

CREATE POLICY "Members can update tags"
  ON public.script_tags FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_members.project_id = script_tags.project_id
      AND project_members.user_id = auth.uid()
  ));

CREATE POLICY "Members can delete tags"
  ON public.script_tags FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_members.project_id = script_tags.project_id
      AND project_members.user_id = auth.uid()
  ));


-- ── 3. script_revisions — tracks revision changes per project ───────────────
-- When a new script revision is uploaded, this stores the diff (changes,
-- reviewed status). One row per project (latest revision only).

CREATE TABLE IF NOT EXISTS public.script_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  changes JSONB NOT NULL DEFAULT '[]',
  reviewed_scene_ids JSONB NOT NULL DEFAULT '[]',
  filename TEXT NOT NULL DEFAULT '',
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id)
);

ALTER TABLE public.script_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view revisions"
  ON public.script_revisions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_members.project_id = script_revisions.project_id
      AND project_members.user_id = auth.uid()
  ));

CREATE POLICY "Members can insert revisions"
  ON public.script_revisions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_members.project_id = script_revisions.project_id
      AND project_members.user_id = auth.uid()
  ));

CREATE POLICY "Members can update revisions"
  ON public.script_revisions FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_members.project_id = script_revisions.project_id
      AND project_members.user_id = auth.uid()
  ));

CREATE POLICY "Members can delete revisions"
  ON public.script_revisions FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_members.project_id = script_revisions.project_id
      AND project_members.user_id = auth.uid()
  ));


-- ── Verification ────────────────────────────────────────────────────────────

SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('budget_data', 'script_tags', 'script_revisions');
-- Expected: 3 rows
