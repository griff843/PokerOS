# Poker OS — Coach Equivalence Requirements

## Purpose

This document defines the **capability requirements for Poker OS to approach real poker coach–level training quality**.

These requirements exist so that:

- LLMs implementing features understand the **true target**
- future development is aligned with the **coach-equivalence vision**
- the system evolves intentionally rather than adding random features

This document complements:

- `COACH_EQUIVALENCE_ROADMAP.md`
- `COACH_EQUIVALENCE_GAP_TRACKER.md`

---

# Target Definition

Poker OS should eventually become:

> A coach-like poker training system capable of replacing a significant portion of paid coaching reps.

The system must support:

- deliberate practice
- strategic reasoning
- range understanding
- conceptual diagnosis
- targeted training intervention
- longitudinal player development

---

# Tier Definitions

## Tier 1 — Credible Premium Trainer

Minimum capabilities required to be taken seriously as a poker training product.

### Requirements

- Structured training loop
- Drill → review → improvement workflow
- Concept-based weakness detection
- Confidence tracking
- Coaching explanations
- Longitudinal progress tracking
- Honest transparency about missing data

### Already Implemented

Poker OS currently satisfies most Tier 1 requirements.

---

# Tier 2 — Coach-Like System

Capabilities required for the system to behave **similarly to a real coach in structured scenarios**.

### Required Capabilities

#### Persistent learner memory

The system must remember:


attempt history
confidence history
review behavior
reflections
concept resolution


All coaching decisions should reference the learner model.

---

#### Range-based teaching

Users must be able to understand:


value region
bluff region
bluff catchers
blockers
threshold combos
mixing behavior


Teaching must focus on **range logic**, not memorized answers.

---

#### Diagnostic reasoning capture

The system must evaluate **how the student thinks**, not just the selected action.

Possible signals:


reasoning prompts
confidence mismatch
pattern errors
misunderstanding categories


---

#### Misunderstanding classification

Errors should be categorized into coaching-relevant types:


line misunderstanding
threshold miscalculation
range construction error
blocker blindness
pool assumption error
confidence miscalibration


---

#### Intervention planning

The system should generate targeted training sequences.

Example:


turn-defense drills
→ followed by
river bluff-catching drills


rather than recommending unrelated drills.

---

# Tier 3 — Near Pro-Coach Substitute

Capabilities required to approximate the effectiveness of a strong poker coach in many structured contexts.

### Required Capabilities

#### Real hand ingestion

The system should support analyzing:


PokerTracker hands
Holdem Manager exports
manual hand histories


The system must connect **practice leaks** to **real-play leaks**.

---

#### Mixed-strategy teaching

When spots mix actions, the system should explain:


combo properties
blocker influence
range advantage shifts
indifference thresholds


---

#### Adaptive coaching behavior

The system should adapt to different player profiles:


overconfident players
passive/confused learners
technically strong but sloppy threshold players
solver-literal learners
exploit-heavy learners


---

# Capabilities That Are Likely Impossible to Fully Automate

Some human coaching abilities are extremely difficult to replicate:

- emotional awareness
- fatigue detection
- psychological cues
- live table context
- subjective prioritization

Poker OS should aim to replicate **structured coaching logic**, not human intuition.

---

# Success Criteria

Poker OS can be considered near coach-equivalent when it:

- teaches range reasoning clearly
- diagnoses conceptual misunderstandings
- remembers learner behavior across time
- plans targeted interventions
- integrates real-play data into training