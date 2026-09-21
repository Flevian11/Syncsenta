'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, GraduationCap, School, ShieldCheck, Users, Video } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RoleGate } from '@/components/auth/role-gate';
import { useAuth } from '@/hooks/use-auth';
import { liveClassesForGrade, timetableForGrade } from '@/lib/learning-plan';
import { supabase } from '@/lib/supabase/client';

interface SchoolAggregate {
  school_name: string;
  grade: string;
  subject: string;
  learner_count: number;
  evidence_count: number;
  average_mastery_percentage: number | null;
  latest_evidence_at: string | null;
}

function HeadContent() {
  const { profile } = useAuth();
  const [aggregates, setAggregates] = useState<SchoolAggregate[]>([]);
  const [aggregatesLoading, setAggregatesLoading] = useState(true);
  const name = profile?.full_name || 'Head of School';
  const school = profile?.school_name || 'Syncsenta International School';

  useEffect(() => {
    let cancelled = false;
    async function loadAggregates() {
      setAggregatesLoading(true);
      const { data, error } = await (supabase as any)
        .from('school_learning_aggregates')
        .select('school_name, grade, subject, learner_count, evidence_count, average_mastery_percentage, latest_evidence_at')
        .eq('school_name', school)
        .order('grade', { ascending: true })
        .order('subject', { ascending: true });
      if (!cancelled) {
        if (error) console.error('Unable to load school learning aggregates:', error);
        setAggregates((data ?? []) as SchoolAggregate[]);
        setAggregatesLoading(false);
      }
    }
    void loadAggregates();
    return () => { cancelled = true; };
  }, [school]);

  const primaryGrade = aggregates[0]?.grade || 'Selected grade';
  const timetable = timetableForGrade(primaryGrade);
  const liveClasses = liveClassesForGrade(primaryGrade);
  const learnerCount = aggregates.reduce((total, item) => total + item.learner_count, 0);
  const evidenceCount = aggregates.reduce((total, item) => total + item.evidence_count, 0);
  const masteryValues = aggregates.map((item) => item.average_mastery_percentage).filter((value): value is number => value !== null);
  const averageMastery = masteryValues.length ? Math.round(masteryValues.reduce((sum, value) => sum + value, 0) / masteryValues.length) : null;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 md:px-8 md:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 rounded-2xl border bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <Badge variant="secondary">Head of School workspace</Badge>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Karibu, {name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{school} · school-level learning operations</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-teal-50 px-4 py-3 text-sm text-teal-900">
            <ShieldCheck className="h-5 w-5 text-teal-700" />
            <span>Role-scoped school view</span>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="School overview">
          <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><School className="h-4 w-4 text-teal-600" />School</CardTitle></CardHeader><CardContent><p className="font-semibold">{school}</p><p className="text-xs text-muted-foreground">{aggregates.length ? `${aggregates.length} evidence-backed subject views` : 'Loading school evidence…'}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Users className="h-4 w-4 text-blue-600" />Learners</CardTitle></CardHeader><CardContent><p className="font-semibold">{aggregatesLoading ? 'Loading…' : learnerCount}</p><p className="text-xs text-muted-foreground">Distinct learners represented by evidence</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><ShieldCheck className="h-4 w-4 text-emerald-600" />Evidence</CardTitle></CardHeader><CardContent><p className="font-semibold">{aggregatesLoading ? 'Loading…' : evidenceCount}</p><p className="text-xs text-muted-foreground">Durable learning evidence records</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><GraduationCap className="h-4 w-4 text-violet-600" />Average mastery</CardTitle></CardHeader><CardContent><p className="font-semibold">{averageMastery === null ? '—' : `${averageMastery}%`}</p><p className="text-xs text-muted-foreground">Derived from evidence, not raw chat</p></CardContent></Card>
        </section>

        <Card>
          <CardHeader><CardTitle>Evidence-backed school aggregate</CardTitle><CardDescription>Only school-level aggregates are shown here; raw student chat and private tutor context remain excluded.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {aggregates.map((item) => (
              <div key={`${item.grade}-${item.subject}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                <div><p className="text-sm font-semibold">{item.subject}</p><p className="text-xs text-muted-foreground">{item.grade} · {item.evidence_count} evidence record{item.evidence_count === 1 ? '' : 's'}</p></div>
                <Badge variant="secondary">{item.average_mastery_percentage === null ? 'No mastery score' : `${Math.round(item.average_mastery_percentage)}% average mastery`}</Badge>
              </div>
            ))}
            {!aggregatesLoading && aggregates.length === 0 && <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">No evidence-backed aggregates are available yet.</p>}
          </CardContent>
        </Card>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-teal-600" />School timetable view</CardTitle><CardDescription>Shared schedule contract used by the student and head workspaces.</CardDescription></CardHeader>
            <CardContent className="space-y-2">{timetable.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-lg border p-3"><div className="w-24 text-xs font-medium text-muted-foreground">{item.day}<br />{item.time}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.subject}</p><p className="truncate text-xs text-muted-foreground">{item.activity}</p></div><Badge variant="outline" className="capitalize">{item.mode}</Badge></div>)}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Video className="h-5 w-5 text-rose-600" />Live class oversight</CardTitle><CardDescription>Teacher-led sessions visible at school level without exposing student chat.</CardDescription></CardHeader>
            <CardContent className="space-y-3">{liveClasses.map((item) => <div key={item.id} className="flex items-start gap-3 rounded-lg border p-3"><CheckCircle2 className={`mt-0.5 h-4 w-4 ${item.status === 'live' ? 'text-rose-600' : 'text-slate-400'}`} /><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{item.title}</p><p className="text-xs text-muted-foreground">{item.subject} · {item.grade} · {item.teacher}</p><p className="mt-1 text-xs text-muted-foreground">{item.time}</p></div><Badge variant={item.status === 'live' ? 'destructive' : 'secondary'}>{item.status === 'live' ? 'Live now' : 'Upcoming'}</Badge></div>)}</CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}

export default function HeadPage() {
  return <RoleGate allowedRoles={['head', 'admin']}><HeadContent /></RoleGate>;
}
