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

## Next step

Once answers are in: synthesize into a proper problem doc, then brainstorm
the actual spec (data model, sync, MCP connectors) before any code.
