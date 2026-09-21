# Reference repository notes for agent-assisted changes

These notes record the implementation guidance used for the current SyncSenta tutoring work.

- `https://github.com/dgithinjibit/skills` redirects to `mattpocock/skills`. The implementation skill requires small, deliberate changes, regular typechecking, focused tests, a final full-suite check, and a code-review pass. The domain-modeling and codebase-design guidance emphasizes shared vocabulary and deep module seams.
- `https://github.com/dgithinjibit/i-have-adhd` redirects to `ayghri/i-have-adhd`. Its canonical skill requires action-first communication, numbered bounded steps, visible progress, matter-of-fact errors, and concise next actions. Its agent guide requires reading the repository map, running the smallest relevant checks, and reporting exact commands and results.
- `https://github.com/ruvnet/ruflo` is required as an additional reference for the current task. Inspect its agent-orchestration and workflow patterns before implementation; use only principles that fit SyncSenta's existing architecture and child-safety constraints.

The agent cannot provide private chain-of-thought. It will provide a concise implementation plan, explicit design decisions, files changed, and verification results.
