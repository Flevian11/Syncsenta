import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase/route-handler';

/**
 * API Route: /api/teacher/assignments
 *
 * CRUD over the teacher's own grade/subject assignments.
 *
 * Security model:
 *   - Caller is identified by their session cookie (Supabase Auth).
 *   - `teacherId` is ALWAYS derived from `auth.getUser()`. We do not
 *     accept it from query strings or request bodies — every previous
 *     `?teacherId=...` parameter is now ignored, and the equivalent
 *     fields in POST/PUT/DELETE bodies are dropped.
 *   - The Supabase client is cookie-aware and uses the anon key, so
 *     RLS policies (auth.uid() = teacher_id) act as the second line
 *     of defense behind the explicit `user.id` checks below.
 */

type AssignmentInput = {
  grade: string;
  level: string;
  teaching_model?: 'generalist' | 'specialist';
  subject_category?: string | null;
  subjects?: string[];
};

function groupCanonicalAssignments(
  rows: Array<{ id: string; class_name: string; subject: string | null; status: string | null }>,
) {
  const grouped = new Map<string, {
    id: string;
    grade: string;
    level: string;
    teaching_model: 'generalist' | 'specialist';
    subjects: string[];
    is_active: boolean;
  }>();

  for (const row of rows) {
    const match = row.class_name.match(/(PP[12]|Grade [1-9])/i);
    if (!match) continue;

    const grade = match[1].replace(/^pp/i, 'PP').replace(/^grade/i, 'Grade');
    const level = ['Grade 1', 'Grade 2', 'Grade 3'].includes(grade)
      ? 'lower-primary'
      : ['Grade 4', 'Grade 5', 'Grade 6'].includes(grade)
        ? 'upper-primary'
        : grade.startsWith('Grade')
          ? 'junior-secondary'
          : 'pre-primary';
    const current = grouped.get(grade) ?? {
      id: `canonical-${grade.toLowerCase().replace(/\s+/g, '-')}`,
      grade,
      level,
      teaching_model: ['Grade 1', 'Grade 2', 'Grade 3'].includes(grade) ? 'generalist' : 'specialist',
      subjects: [],
      is_active: true,
    };

    if (row.subject && !current.subjects.includes(row.subject)) current.subjects.push(row.subject);
    grouped.set(grade, current);
  }

  return [...grouped.values()];
}

async function requireUser() {
  const supabase = await createSupabaseRouteHandlerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return {
      // The `as any` cast is a deliberate hole: the generated
      // `Database` types in src/lib/supabase/types.ts don't yet
      // include teacher_grade_assignments / teacher_subject_assignments
      // (added in migration 003). Once you regenerate types from
      // the live schema (`supabase gen types typescript ...`), this
      // cast can come out and the queries below will be fully typed.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: supabase as any,
      user: null,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { supabase: supabase as any, user, response: null };
}

// ═══════════════════════════════════════════════════════════════════════════
// GET: fetch the calling teacher's assignments
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(_request: NextRequest) {
  try {
    const { supabase, user, response } = await requireUser();
    if (!user) return response;

    // Fetch grade assignments. RLS limits the result to this teacher,
    // but the explicit `.eq('teacher_id', user.id)` makes the intent
    // obvious in code review and survives policy regressions.
    const { data: gradeAssignments, error: gradeError } = await supabase
      .from('teacher_grade_assignments')
      .select('*')
      .eq('teacher_id', user.id)
      .eq('is_active', true)
      .order('grade');

    if (gradeError) console.warn('Legacy grade assignments unavailable; using canonical assignments:', gradeError.message);

    const { data: subjectAssignments, error: subjectError } = await supabase
      .from('teacher_subject_assignments')
      .select('*')
      .eq('teacher_id', user.id)
      .eq('is_active', true)
      // PostgREST treats `.order(string)` as a single column name, so
      // the previous `.order('grade, subject')` was a no-op on the
      // second key. Chain two `.order()` calls instead.
      .order('grade')
      .order('subject');

    if (subjectError) console.warn('Legacy subject assignments unavailable; using canonical assignments:', subjectError.message);

    if (gradeError || subjectError || !(gradeAssignments ?? []).length) {
      const { data: canonicalRows, error: canonicalError } = await supabase
        .from('teacher_student_assignments')
        .select('id, class_name, subject, status')
        .eq('teacher_id', user.id)
        .eq('status', 'active')
        .limit(500);

      if (canonicalError) {
        console.error('Error fetching canonical teacher assignments:', canonicalError);
        return NextResponse.json({ error: 'Failed to fetch teacher assignments' }, { status: 500 });
      }

      const canonical = groupCanonicalAssignments(canonicalRows ?? []);
      return NextResponse.json({
        success: true,
        data: { grades: canonical, subjects: [], grouped: canonical },
      });
    }

    const grouped = (gradeAssignments ?? []).map((grade: { grade: string }) => ({
      ...grade,
      subjects: (subjectAssignments ?? [])
        .filter((s: { grade: string }) => s.grade === grade.grade)
        .map((s: { subject: string }) => s.subject),
    }));

    return NextResponse.json({
      success: true,
      data: {
        grades: gradeAssignments ?? [],
        subjects: subjectAssignments ?? [],
        grouped,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/teacher/assignments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POST: upsert the calling teacher's assignments
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const { supabase, user, response } = await requireUser();
    if (!user) return response;

    const body = await request.json().catch(() => null);
    if (!body || !Array.isArray(body.assignments)) {
      return NextResponse.json(
        { error: 'Invalid request body. Expected { assignments: [...] }' },
        { status: 400 },
      );
    }
    const assignments = body.assignments as AssignmentInput[];

    // Force teacher_id from the session — any `teacherId` field in
    // the body is silently ignored.
    const gradeRows = assignments.map((a) => ({
      teacher_id: user.id,
      grade: a.grade,
      level: a.level,
      teaching_model: a.teaching_model ?? 'specialist',
      is_active: true,
    }));

    const { data: insertedGrades, error: gradeError } = await supabase
      .from('teacher_grade_assignments')
      .upsert(gradeRows, {
        onConflict: 'teacher_id,grade',
        ignoreDuplicates: false,
      })
      .select();

    if (gradeError) {
      console.error('Error inserting grade assignments:', gradeError);
      return NextResponse.json(
        { error: 'Failed to create grade assignments', details: gradeError.message },
        { status: 500 },
      );
    }

    const subjectRows = assignments
      .filter((a) => Array.isArray(a.subjects) && a.subjects.length > 0)
      .flatMap((a) =>
        (a.subjects ?? []).map((subject) => ({
          teacher_id: user.id,
          grade: a.grade,
          subject,
          subject_category: a.subject_category ?? null,
          is_active: true,
        })),
      );

    let insertedSubjects: typeof subjectRows | null = null;
    if (subjectRows.length > 0) {
      const { data, error: subjectError } = await supabase
        .from('teacher_subject_assignments')
        .upsert(subjectRows, {
          onConflict: 'teacher_id,grade,subject',
          ignoreDuplicates: false,
        })
        .select();

      if (subjectError) {
        console.error('Error inserting subject assignments:', subjectError);
        return NextResponse.json(
          { error: 'Failed to create subject assignments', details: subjectError.message },
          { status: 500 },
        );
      }
      insertedSubjects = data;
    }

    return NextResponse.json({
      success: true,
      data: { grades: insertedGrades, subjects: insertedSubjects },
    });
  } catch (error) {
    console.error('Error in POST /api/teacher/assignments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PUT: update one of the calling teacher's assignments
// ═══════════════════════════════════════════════════════════════════════════

export async function PUT(request: NextRequest) {
  try {
    const { supabase, user, response } = await requireUser();
    if (!user) return response;

    const body = await request.json().catch(() => null);
    if (!body || !body.assignmentId || !body.updates) {
      return NextResponse.json(
        { error: 'Invalid request body. Expected { assignmentId, updates }' },
        { status: 400 },
      );
    }

    const { assignmentId, updates } = body as { assignmentId: string; updates: Record<string, unknown> };

    // Defense in depth: strip teacher_id from the update payload —
    // a teacher must not be able to reassign a row to a different
    // user, even via a forged PATCH.
    if ('teacher_id' in updates) delete updates.teacher_id;
    if ('id' in updates) delete updates.id;

    const isGradeUpdate = 'grade' in updates || 'level' in updates || 'teaching_model' in updates;
    const table = isGradeUpdate ? 'teacher_grade_assignments' : 'teacher_subject_assignments';

    const { data, error } = await supabase
      .from(table)
      .update(updates)
      .eq('id', assignmentId)
      .eq('teacher_id', user.id)
      .select();

    if (error) {
      console.error(`Error updating ${table}:`, error);
      return NextResponse.json(
        { error: `Failed to update ${isGradeUpdate ? 'grade' : 'subject'} assignment` },
        { status: 500 },
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: data[0] });
  } catch (error) {
    console.error('Error in PUT /api/teacher/assignments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DELETE: soft-delete one of the calling teacher's assignments
// ═══════════════════════════════════════════════════════════════════════════

export async function DELETE(request: NextRequest) {
  try {
    const { supabase, user, response } = await requireUser();
    if (!user) return response;

    const { searchParams } = new URL(request.url);
    const assignmentId = searchParams.get('assignmentId');
    const type = searchParams.get('type'); // 'grade' | 'subject'

    if (!assignmentId || (type !== 'grade' && type !== 'subject')) {
      return NextResponse.json(
        { error: 'Missing or invalid parameters. Need assignmentId and type=grade|subject' },
        { status: 400 },
      );
    }

    const table = type === 'grade' ? 'teacher_grade_assignments' : 'teacher_subject_assignments';

    const { data, error } = await supabase
      .from(table)
      .update({ is_active: false })
      .eq('id', assignmentId)
      .eq('teacher_id', user.id)
      .select();

    if (error) {
      console.error(`Error deleting ${table}:`, error);
      return NextResponse.json(
        { error: `Failed to delete ${type} assignment` },
        { status: 500 },
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Assignment deleted successfully' });
  } catch (error) {
    console.error('Error in DELETE /api/teacher/assignments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Made with Bob
