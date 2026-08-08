# Trainer Persona — working notes

Post-MVP, exploratory. Not in `BLUEPRINT.md` scope — parked here + Todoist
`E16 · Trainer Persona (CRM + Coaching Tool)` until requirements are real.

## What it is

Persona/mode for trainers who train other people, distinct from the
consumer skill-guide+chat experience. CRM-shaped: client profiles ("story"
per client), progress tracking, routine building, exercise counting,
scheduling/reminders, Excel sync. Chat + tools, not just a guide. Future:
coach vs. student split.

## Requirements gathering

Sent a 10-question interview (JTBD/Mom-Test style — concrete past behavior,
not opinions) to a trainer friend.

- Live artifact (share this link): https://claude.ai/code/artifact/ce5b8a61-ff2e-41ac-8398-6eab52edf822
- Local copy of the same page: [`questionnaire.uk.html`](./questionnaire.uk.html)
- Todoist: section `E16 · Trainer Persona (CRM + Coaching Tool)` in
  **Skills Distribution & Monetization**, 2 tasks (send/collect, synthesize)

Question map → candidate tech:
- Q1–Q4 (onboarding, edit, progress, routines) → Firestore client table,
  add/edit/progress UI
- Q5 (scheduling/reminders) → validates or kills Google Calendar / Todoist
  MCP idea
- Q6 (spreadsheets) → Excel import/sync
- Q7–Q10 (past tools, exercise tracking, pain, data criticality) →
  prioritization signal

## Answers in (n=2)

Two trainers answered. Synthesis: [`FINDINGS.md`](./FINDINGS.md).

Headline: the scope above is too wide for what the evidence supports. Excel
sync, program templates and backup-as-value all got contradicted directly.
The one confirmed pain is **session accounting off the calendar** — Trainer A
hand-built it with Claude and still cross-checks it against a paper notebook.
Pain tracks client volume; the low-volume respondent had none at all.

## Next step

1. Three-question follow-up (packages/payment, re-ask Q4 for Trainer A, what
   would have made them upgrade Hevy).
2. Interview one trainer who is running a studio *now* — both respondents sit
   at the low-volume end.
3. Then brainstorm the spec, scoped to the session ledger + freeform client
   notes, not the full CRM.
