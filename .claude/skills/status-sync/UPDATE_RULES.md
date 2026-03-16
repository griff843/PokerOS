# Update Rules — Status Sync

> These rules govern what gets updated and when during `/status-sync`.

---

## CURRENT_SYSTEM_STATUS.md Update Rules

### "What is done" section
- **Add** when a sprint delivers a named feature, surface, or capability
- **Do not add** partial work — only completed, verified deliverables
- Organize by logical grouping (CLI Layer, Table Sim, AI OS, etc.)
- Include version or sprint label if relevant (e.g., "v1.3.1 COMPLETE")

### "What is in progress" section
- **Update** to reflect the actual current sprint or workstream
- Remove items that completed in the just-closed sprint
- Add items that were discovered or started during the sprint

### "What is next" section
- **Update** to reflect the highest-priority items after the sprint
- Remove items that were completed
- Add newly identified gaps from the closeout report
- Keep to 5 or fewer items — this is the actionable queue, not a full backlog

### "Active constraints" section
- **Update only** when a constraint was added, removed, or changed
- Do not remove constraints unless they were explicitly resolved

### "Key file paths" section
- **Update** when new canonical paths are established
- Do not remove paths unless they were deleted from the repo

---

## context_bundle.md Update Rules

### "Recent Sprint History" table
- **Add a row** for every completed sprint
- Format: `| Sprint name | COMPLETE — one-sentence summary |`
- Keep the most recent 5–8 sprints; archive older ones or drop them

### "What Is Complete" section
- **Update** when a major surface reaches a milestone (e.g., "Review Mode COMPLETE")
- Do not add partial features here

### "Known Gaps / Next Work" section
- **Update** to reflect the current forward queue
- Align with the status doc's "What is next"

### "Active Architecture Constraints" section
- **Update** only when a constraint changes
- Must stay in sync with the status doc's "Active constraints"

---

## What Triggers an Adapter Update

Update `AI_PROJECT_ADAPTER_POKER_v1.md` when:
- The active phase name changes
- A new canonical doc path is established that should be in the truth stack
- The artifact conventions change
- A new domain boundary is discovered and should be documented

Do not update the adapter for every sprint — only when the project's identity or truth structure changes.
