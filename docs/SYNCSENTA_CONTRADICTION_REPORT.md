# SyncSenta Contradiction and Workflow Audit

**Audit scope:** branches, historical commits, demo-account wiring, student onboarding, dashboards, sandbox activation, tutoring routes, parent/teacher/head routes, grade model, and repeated workflow implementations.

**Audit result:** the canonical routing, controlled demo login, student dashboard, sandbox-preparation seam, and `/head` workspace have now been implemented. Live Supabase account verification remains pending because the configured Supabase connector is still disabled.

## Executive conclusion

The repository has a strong set of LMS building blocks, but the user-facing journey is currently a hybrid of several historical designs. The main contradictions are not primarily missing features; they are competing canonical paths and inconsistent demo context.

The recommended canonical learner flow is:

```text
/login/student
  → /student/journey
  → school level
  → grade
  → /student
  → timetable and dashboard
  → subject learning area
  → sandbox preparation in the background
  → lesson, quiz, or Socratic tutor
```

Subject selection should no longer be the terminal step of `/student/journey`. The student should arrive at `/student` immediately after grade selection.

## Repository and history findings

After unshallowing the repository, the available remote history is on `origin/main`; there are no additional remote branches currently available. The historical commits do contain useful LMS direction, so the absence of branches does not mean the work is lost.

| Commit | Relevant evidence | Recommendation |
|---|---|---|
| `6f60887` | Test accounts were declared ready | Preserve the existing identities; do not create replacement roles |
| `f5044de` | Parent dashboard was explicitly fixed | Use this as historical context, then validate the current `/parent` implementation against live data |
| `8967c34` | Google OAuth was replaced by demo-account buttons for MVP testing | Preserve the demo-login contract, but remove role-specific feature-flag ambiguity for controlled testing |
| `71d7ce1` | Adaptive sandbox was made the student's first learning step | Preserve sandbox-first lesson activation, but move it after the LMS dashboard rather than before the dashboard |
| `3f5c4b0` | Dead code and duplicates were removed | Continue this consolidation; current routes still contain duplicate user journeys |
| `5497ba6` | Subject-session flow was introduced | Preserve the current authenticated chat/session persistence, but make it a child route of the LMS dashboard |
| `58a6a90` | Omega, session persistence, and URL-routing work were introduced | Treat these as platform services, not alternate student homepages |

## Demo-account contract

The repository's actual seeded identities are email-based, not named `student_1`, `teacher_1`, `head_1`, and `parent_1` in the database. The current migration maps the conceptual roles as follows:

| Conceptual test account | Existing Supabase email | Existing profile role | Existing seeded context |
|---|---|---|---|
| `student_1` | `student01@syncsenta.dev` | `student` | Grade 4, SIS-STU-001, Grade 4A |
| `teacher_1` | `teacher01@syncsenta.dev` | `teacher` | Mathematics and English, Grade 4A |
| `head_1` | `head01@syncsenta.dev` | `admin` | Demo Head of School |
| `parent_1` | `parent01@syncsenta.dev` | `parent` | Children list contains the seeded student UUID |

The migration also creates the student record, teacher-student assignment, learner consent, parent report seed, and head notification seed using these identities. This is the correct account graph to retain.

### Live verification status

The repository migration still defines the intended four-account graph and the implementation now routes all four named demo roles through the server-side Supabase login path without a signup fallback. The student demo context is consistently Grade 4, matching the seeded `student01@syncsenta.dev` profile.

The live `auth.users`, `profiles`, assignment, consent, report, and head-notification rows were **not queried in this implementation pass** because the configured Supabase connector is disabled in the current task. No new roles or accounts were created. The next verification step is a read-only Supabase query after the connector is enabled.

## Current route contradictions

| Area | Current state | Conflict | Canonical decision |
|---|---|---|---|
| Student login | `/login/student` signs in and navigates to `/student`; the dashboard sends students without saved grade context to `/student/journey` | The deployed experience can appear to jump from login to journey while the source login targets dashboard | Keep `/student` as the post-auth destination; dashboard redirects to journey only when grade context is absent |
| Journey | `/student/journey` currently has level → grade → subject | User requirement is level → grade → `/student` | Remove subject as a required journey step |
| Journey labels | Age guidance is now shown adjacent to level and grade, e.g. “Typical ages 7–10” | User-facing model must remain grade-first while retaining useful age context | Keep grade as the selection key; retain date of birth and derive age bands internally for safety/personalization |
| Curriculum levels | Includes Pre-Primary and Senior Secondary, while the requested supported model is Lower Primary, Upper Primary, and Junior Secondary | Scope and terminology are mixed | Keep the requested Grade 1–9 learner path first; leave PP and Senior Secondary as explicitly unsupported or a later scope, not silently mixed into the primary flow |
| Grade context | Demo login injects Grade 2; database seed says Grade 4; static demo page says Grade 2 | A single student can appear to be in different grades depending on entry path | Make `student01@syncsenta.dev` / conceptual `student_1` Grade 4 everywhere for the first workflow test |
| Subject path | Subject cards and subject-session routes support chat; historical dashboard commits moved the “Start learning” action toward sandbox | Chat-first and sandbox-first paths coexist | Dashboard subject cards should open a learning area that can prepare the sandbox and then offer lesson, quiz, and tutor modes |
| Sandbox | `/student/sandbox`, `/student/sandbox/[grade]/[subject]`, and activity routes exist | Several entry points can start a lesson independently | Keep the activity route as the execution endpoint; use one dashboard launcher and background preparation/preflight |
| Student dashboards | `/student` is canonical; `/student/demo` is now a compatibility redirect; `/student/tutor-dashboard` remains a child tool | Three competing homes previously undermined LMS identity | Canonical home: `/student`; the legacy demo no longer renders mock data, and tutor-dashboard remains a focused tool rather than a home |
| Teacher dashboards | `/teacher`, `/teacher/dashboard`, and additional analytics pages/components exist | Role entry and dashboard detail routes overlap | Canonical role entry: `/teacher`; detail pages remain child tools |
| Parent dashboards | `/parent` is the current consent-aware family space; `/parent/dashboard` is a separate legacy/dashboard implementation | Two parent homes can show different data models | Canonical role entry: `/parent`; `/parent/dashboard` should be compared and then redirected or retired |
| Head dashboard | `/head` is now a protected `admin` workspace with timetable and live-class oversight | The previous destination pointed to an incomplete/mock-only surface | Keep `/head` as the canonical school-level entrypoint and retain role-scoped visibility |
| Demo login | All four named demo roles now use the same server-side route; invalid roles return to sign-in | Live account existence still needs a direct read-only query | Preserve accounts, do not create replacement roles, and verify the existing graph through Supabase once enabled |

## Date-of-birth decision

Date of birth should be retained. It is used in the API to derive an internal age band for safety and learner-context personalization. It should not be the visible onboarding navigation model.

The correct separation is:

```text
Visible learner selection: school level → grade
Stored profile data: date_of_birth
Internal safety signal: derived age band
Pedagogical scope: selected grade and subject
```

The current `AgeThemeProvider` and `themeFromGrade()` can remain as presentation logic, but the naming should eventually be changed from age-centric terminology where it controls visual or navigation decisions. The age band must not override the selected grade.

## LMS architecture recommendation

The system should be treated as an LMS with a tutor capability, not as a chatbot with surrounding pages.

The canonical dashboard should own:

- Grade and class context
- Timetable and today’s learning plan
- Subject cards
- Progress and competency map
- Lesson and quiz entry points
- Sandbox preparation status
- Teacher feedback and intervention indicators
- Safe, bounded access to the Socratic tutor

The student should not have to choose “chat” as the first action. A subject lesson can use the tutor as one activity mode alongside sandbox practice, quiz, reflection, and teacher feedback.

The intended subject sequence is:

```text
Student dashboard
  → open subject learning area
  → preflight sandbox/activity availability in background
  → show lesson objective and timetable context
  → start lesson, quiz, sandbox, or tutor
  → persist learning evidence
```

## Recommended cleanup order after report review

1. Canonicalize the four demo identities around the existing seeded accounts. **Implemented in source; live rows pending query.**
2. Make the deployed demo environment capable of testing all four roles without signup redirects. **Implemented in source; deployment probe pending.**
3. Change journey from level → grade → subject to level → grade → dashboard. **Implemented.**
4. Keep grade primary, show age guidance adjacent, and retain date of birth/internal age-band derivation. **Implemented.**
5. Set the demo student context consistently to the seeded Grade 4. **Implemented.**
6. Add or restore the `/head` route before testing `head_1`. **Implemented.**
7. Compare `/student/tutor-dashboard` with `/student`, then redirect or retire the duplicate. **Canonical `/student` is established; tutor-dashboard remains a child tool.**
8. Compare `/parent/dashboard` with `/parent`, then retain one canonical parent entry point.
9. Add dashboard-owned subject learning areas with sandbox preflight and lesson/quiz/tutor modes.
10. Run the full four-role workflow using the existing accounts and verify teacher, parent, and head visibility boundaries.

## Audit references used

This audit followed the repository-aware implementation discipline from the required `dgithinjibit/skills` reference, the bounded and attention-friendly workflow guidance from `dgithinjibit/i-have-adhd`, and the orchestration, memory, auditability, and guardrail principles inspected in `ruvnet/ruflo`. The code should continue to use these references before routing or account changes are implemented.
