# SyncSenta Student Text to Guardian Flow

## Current verified flow

When a student submits text from a subject chat, the browser sends the message, bounded history, grade, subject slug, language, session identifier, competency, and hint count to `POST /api/chat`. The route authenticates the Supabase session, resolves the learner profile, applies the chat rate limit, validates the request with Zod, and uses the profile grade when one is available.

The route then derives the learning track from the subject slug. The active tracks are Kenyan CBC, AGI, Blockchain and Crypto Foundations, and Financial Literacy. Omega reads the learner's `learning_progress` row for that subject, grade, and competency. It chooses `Intensive`, `Guided`, or `Independent` scaffolding using the existing Rust-compatible thresholds: frustration or at least two hints or mastery below 40% produces Intensive; no attempts or mastery below 80% produces Guided; otherwise the learner is Independent. The track policy changes the next pedagogical move and safety language without changing those numeric thresholds.

The Socratic prompt builder receives the selected subject, grade, language, learner context, track focus, and safety boundary. The LLM is told to guide discovery rather than provide an answer immediately, keep the response to two to four sentences, end with a question or choices, remain inside the learning area, and respect the track-specific boundary. AGI uses evidence, uncertainty, and human oversight; blockchain uses shared-ledger reasoning and never requests private keys or transaction details; financial literacy uses fictional everyday scenarios and does not give personalized investment, lending, tax, or payment instructions.

The response streams back to the student as Server-Sent Events. On completion, the route stores the user message and assistant response in `chat_sessions` and `chat_messages`, updates daily activity, classifies the answer quality, updates `learning_progress` counters, persists hints and consecutive wrong turns, writes Omega scaffolding telemetry, and may emit a teacher alert event. The next student turn therefore sees the updated learning state.

## Guardian handoff boundary

The current system does **not** automatically send raw student chat text to a parent. Chat transcripts remain in the student-owned chat tables. Parent visibility is a separate, consent-gated evidence path. A verified guardian relationship is created through a one-time student link code and the `parent_student_links` relationship. Parent-facing performance summaries are written to `parent_performance_reports` only when a valid parent recipient, child profile, consent record, and same-school relationship are present.

The database policy explicitly describes parent reports as consent-gated performance summaries and excludes raw chat and telemetry. The parent policy permits a linked parent to read reports for that child. This separation is the correct default for minors: the parent receives a bounded learning summary, not an unrestricted conversation transcript.

There is currently a product gap after that database boundary. The parent dashboard authenticates the parent and displays demo data when demo mode is enabled, but it does not yet query `parent_performance_reports` for real linked children. Therefore, the backend can produce a consented parent report, but the production parent UI does not yet render that report as a live view.

## Target production flow

The recommended production handoff is:

1. **Student interaction:** accept, authenticate, validate, and rate-limit the student turn.
2. **Tutor decision:** derive the server-side track, load learner state, select Omega scaffolding, and build the constrained Socratic prompt.
3. **Learning evidence:** persist the session, message, answer quality, mastery counters, hint count, and scaffolding event.
4. **Teacher signal:** expose only bounded intervention metadata such as competency, mastery band, consecutive wrong turns, and next activity type.
5. **Consent gate:** aggregate a parent-safe summary only after confirming the active parent link and the consent purpose for learning progress.
6. **Parent report:** write a report with subject, mastery percentage, performance band, teacher summary, and next step; do not include raw chat by default.
7. **Parent UI:** query `parent_performance_reports` through RLS and show the latest track summaries for the linked child.

## Design principles applied

The implementation uses the shared-domain-policy pattern from the required engineering references: one track policy is consumed by the prompt builder, Omega, and server enrichment rather than duplicating track rules in three places. It uses bounded, auditable state transitions rather than an unconstrained agent loop, following the Ruflo reference's emphasis on orchestration, memory, observability, and guardrails while keeping SyncSenta's child-safety and consent model authoritative.
