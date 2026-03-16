# Model Selection — Sprint Planning

> Use this guide when `/sprint-plan` recommends a model for the selected sprint.

---

## Available Models

| Model | ID | Strengths |
|---|---|---|
| Claude Sonnet 4.6 | `claude-sonnet-4-6` | Default — best balance of quality and speed |
| Claude Opus 4.6 | `claude-opus-4-6` | Complex architecture, multi-file coordination |
| Claude Haiku 4.5 | `claude-haiku-4-5-20251001` | Simple, well-scoped tasks — fast and cheap |

---

## Selection Rules

### Use Opus 4.6 when:
- Sprint involves resolving architectural ambiguity
- Sprint touches multiple packages/subsystems simultaneously
- Sprint requires reasoning about complex invariants (e.g., `answer_by_pool` design)
- Sprint involves schema migration with backward-compatibility requirements

### Use Sonnet 4.6 (default) when:
- Sprint is implementation-ready with clear source of truth
- Sprint is medium-complexity UI/API work
- Sprint is a typical feature sprint in Phase 1–3
- Architecture is settled; execution is the challenge

### Use Haiku 4.5 when:
- Sprint is a simple, single-file fix
- Sprint is documentation-only
- Sprint is a proof artifact generation task
- Sprint is a status doc update

---

## Override Rule

If the sprint involves poker-specific strategy logic (drill scenario design, coaching node content, intervention design), use Sonnet 4.6 minimum. These tasks require poker domain reasoning that Haiku may not handle well.
