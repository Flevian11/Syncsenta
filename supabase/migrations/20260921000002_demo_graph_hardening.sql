-- SyncSenta demo-graph hardening.
-- Adds explicit head semantics, makes parent links authoritative, assigns the
-- three extended tracks, and derives school aggregates from durable evidence.

-- 1. Normalize the school-head role while retaining admin as a compatibility role.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role = ANY (ARRAY['student'::text, 'teacher'::text, 'parent'::text, 'admin'::text, 'head'::text]));

UPDATE public.profiles
SET role = 'head', updated_at = now()
WHERE email = 'head01@syncsenta.dev' AND role = 'admin';

-- 2. Make the already-applied guardian-link migration authoritative for parent predicates.
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.syncsenta_is_parent_for(p_student_id TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.parent_student_links link
    JOIN public.profiles parent ON parent.id = link.parent_profile_id
    JOIN public.students student ON student.user_id = link.student_profile_id
    WHERE parent.id = auth.uid()
      AND parent.role = 'parent'
      AND link.status = 'active'
      AND (student.id::text = p_student_id OR student.student_id = p_student_id OR student.user_id::text = p_student_id)
  );
$$;

CREATE OR REPLACE FUNCTION private.syncsenta_is_parent_of(p_subject UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.parent_student_links link
    JOIN public.profiles parent ON parent.id = link.parent_profile_id
    WHERE parent.id = auth.uid()
      AND parent.role = 'parent'
      AND link.student_profile_id = p_subject
      AND link.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION private.syncsenta_is_head_for(p_student_id TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles head
    JOIN public.students student ON student.school_name = head.school_name
    WHERE head.id = auth.uid()
      AND head.role IN ('head', 'admin')
      AND head.school_name IS NOT NULL
      AND (student.id::text = p_student_id OR student.student_id = p_student_id OR student.user_id::text = p_student_id)
  );
$$;

CREATE OR REPLACE FUNCTION private.syncsenta_is_head_of(p_subject UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles head
    JOIN public.profiles student ON student.id = p_subject
    WHERE head.id = auth.uid()
      AND head.role IN ('head', 'admin')
      AND head.school_name IS NOT NULL
      AND head.school_name = student.school_name
  );
$$;

CREATE OR REPLACE FUNCTION public.syncsenta_is_parent_for(p_student_id TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
  SELECT private.syncsenta_is_parent_for(p_student_id);
$$;

CREATE OR REPLACE FUNCTION public.syncsenta_is_parent_of(p_subject UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
  SELECT private.syncsenta_is_parent_of(p_subject);
$$;

CREATE OR REPLACE FUNCTION public.syncsenta_is_head_for(p_student_id TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
  SELECT private.syncsenta_is_head_for(p_student_id);
$$;

CREATE OR REPLACE FUNCTION public.syncsenta_is_head_of(p_subject UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
  SELECT private.syncsenta_is_head_of(p_subject);
$$;

GRANT EXECUTE ON FUNCTION private.syncsenta_is_parent_for(TEXT), private.syncsenta_is_parent_of(UUID), private.syncsenta_is_head_for(TEXT), private.syncsenta_is_head_of(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.syncsenta_is_parent_for(TEXT), public.syncsenta_is_parent_of(UUID), public.syncsenta_is_head_for(TEXT), public.syncsenta_is_head_of(UUID) TO authenticated, service_role;

-- Backfill the existing demo relationship into the canonical table.
INSERT INTO public.parent_student_links (parent_profile_id, student_profile_id, status)
SELECT parent.id, student.id, 'active'
FROM public.profiles parent
JOIN public.profiles student ON student.email = 'student01@syncsenta.dev'
WHERE parent.email = 'parent01@syncsenta.dev'
ON CONFLICT (parent_profile_id, student_profile_id)
DO UPDATE SET status = 'active', revoked_at = NULL, linked_at = now();

-- 3. Give the demo teacher explicit ownership of the extended learning tracks.
INSERT INTO public.teacher_student_assignments (teacher_id, student_id, subject, class_name, academic_year, term, status)
SELECT teacher.id, student_record.id, subject.subject, 'Grade 4A', '2026', 'Term 3', 'active'
FROM public.profiles teacher
JOIN public.students student_record ON student_record.student_id = 'SIS-STU-001'
CROSS JOIN (VALUES ('AGI'), ('Blockchain'), ('Financial Literacy')) AS subject(subject)
WHERE teacher.email = 'teacher01@syncsenta.dev'
ON CONFLICT (teacher_id, student_id, class_name, subject)
DO UPDATE SET academic_year = EXCLUDED.academic_year, term = EXCLUDED.term, status = 'active';

-- 4. Link parent reports to durable learning evidence.
ALTER TABLE public.parent_performance_reports
  ADD COLUMN IF NOT EXISTS source_evidence_id UUID REFERENCES public.learning_evidence(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_parent_reports_source_evidence
  ON public.parent_performance_reports(source_evidence_id);

UPDATE public.parent_performance_reports report
SET source_evidence_id = evidence.id
FROM public.learning_evidence evidence
JOIN public.profiles student ON student.id = evidence.student_profile_id
WHERE report.source_evidence_id IS NULL
  AND report.report_payload ->> 'source' = 'demo-seed'
  AND evidence.source = 'demo-seed'
  AND report.subject = evidence.subject
  AND report.child_profile_id = evidence.student_profile_id;

-- 5. Durable school aggregates sourced from learning evidence, not only notifications.
CREATE TABLE IF NOT EXISTS public.school_learning_aggregates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_name TEXT NOT NULL,
  grade TEXT NOT NULL,
  subject TEXT NOT NULL,
  learner_count INTEGER NOT NULL DEFAULT 0 CHECK (learner_count >= 0),
  evidence_count INTEGER NOT NULL DEFAULT 0 CHECK (evidence_count >= 0),
  average_mastery_percentage NUMERIC(5,2),
  latest_evidence_at TIMESTAMPTZ,
  source_report_ids UUID[] NOT NULL DEFAULT '{}',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_name, grade, subject)
);
CREATE INDEX IF NOT EXISTS idx_school_learning_aggregates_school
  ON public.school_learning_aggregates(school_name, grade, subject);
ALTER TABLE public.school_learning_aggregates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS school_learning_aggregates_service_role_all ON public.school_learning_aggregates;
CREATE POLICY school_learning_aggregates_service_role_all ON public.school_learning_aggregates
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS school_learning_aggregates_head_select ON public.school_learning_aggregates;
CREATE POLICY school_learning_aggregates_head_select ON public.school_learning_aggregates
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles head
    WHERE head.id = auth.uid()
      AND head.role IN ('head', 'admin')
      AND head.school_name = school_learning_aggregates.school_name
  ));
GRANT SELECT ON public.school_learning_aggregates TO authenticated;

INSERT INTO public.school_learning_aggregates (
  school_name, grade, subject, learner_count, evidence_count,
  average_mastery_percentage, latest_evidence_at, source_report_ids, generated_at
)
SELECT
  student.school_name,
  evidence.grade,
  evidence.subject,
  COUNT(DISTINCT evidence.student_profile_id)::integer,
  COUNT(*)::integer,
  ROUND(AVG(CASE
    WHEN evidence.rubric ->> 'mastery' ~ '^[0-9]+(\\.[0-9]+)?$'
      THEN (evidence.rubric ->> 'mastery')::numeric
    WHEN evidence.value ~ '^[0-9]+(\\.[0-9]+)?$'
      THEN evidence.value::numeric
    ELSE NULL
  END), 2),
  MAX(COALESCE(evidence.captured_at, evidence.created_at)),
  COALESCE(ARRAY_AGG(DISTINCT report.id) FILTER (WHERE report.id IS NOT NULL), '{}'),
  now()
FROM public.learning_evidence evidence
JOIN public.profiles student ON student.id = evidence.student_profile_id
LEFT JOIN public.parent_performance_reports report
  ON report.child_profile_id = evidence.student_profile_id
 AND report.subject = evidence.subject
WHERE student.school_name IS NOT NULL
GROUP BY student.school_name, evidence.grade, evidence.subject
ON CONFLICT (school_name, grade, subject)
DO UPDATE SET
  learner_count = EXCLUDED.learner_count,
  evidence_count = EXCLUDED.evidence_count,
  average_mastery_percentage = EXCLUDED.average_mastery_percentage,
  latest_evidence_at = EXCLUDED.latest_evidence_at,
  source_report_ids = EXCLUDED.source_report_ids,
  generated_at = now();

COMMENT ON TABLE public.school_learning_aggregates IS 'Durable school-level aggregates derived from learning_evidence; no raw chat or learner text is stored.';
COMMENT ON COLUMN public.parent_performance_reports.source_evidence_id IS 'Durable evidence row supporting this parent-visible summary.';
