# Poker Decision Map

## Purpose

The decision map defines the full set of decision contexts players must master.

It acts as the curriculum for Poker Coach OS, prioritized for **live mid/high stakes** play.

---

## Training Philosophy

The system trains **concept mastery** rather than memorization of exact hands.

Each node teaches a strategic principle that applies across many similar spots.

Drills are prioritized by:
1. **Frequency** — how often does this spot come up in a live session?
2. **EV impact** — how much money does getting this wrong cost?
3. **Exploit leverage** — does the correct play change significantly by player pool?

---

## Core Decision Layers

### Preflop (20 nodes)

The most frequent decisions in poker. Every hand starts here.

| Node Category | Nodes | Priority | Exploit Variance |
|---|---|---|---|
| **Opening ranges by position** | 6 (UTG, HJ, CO, BTN, SB, BB limp) | HIGH | Low (ranges are standard) |
| **Facing opens** (call/3-bet/fold) | 4 (vs EP, vs CO, vs BTN, vs SB) | HIGH | Medium (Pool B 3-bets tight) |
| **3-bet pot construction** | 4 (IP 3-bet, OOP 3-bet, vs 3-bet IP, vs 3-bet OOP) | HIGH | Medium |
| **4-bet decisions** | 3 (4-bet/fold, facing 4-bet, 5-bet shove) | MEDIUM | Low |
| **Squeeze / cold-call** | 3 (squeeze spots, cold-call multiway) | MEDIUM | High (live-specific) |

### Flop (20 nodes)

Where ranges collide with board texture. The richest decision layer.

| Node Category | Nodes | Priority | Exploit Variance |
|---|---|---|---|
| **SRP c-bet (IP)** | 3 (dry, wet, paired boards) | HIGH | High (Pool B overfolds) |
| **SRP c-bet (OOP)** | 2 (favorable, unfavorable textures) | HIGH | High |
| **Facing c-bet** | 3 (call, raise, fold spots) | HIGH | Medium |
| **Check-raise** | 2 (value, bluff construction) | MEDIUM | High (Pool B folds too much) |
| **3BP c-bet** | 3 (IP, OOP, facing) | HIGH | Medium |
| **4BP flop play** | 2 (c-bet, check) | MEDIUM | Low |
| **Multiway flop** | 3 (c-bet, check, facing bet) | HIGH | High (live = multiway) |
| **Donk bet** | 2 (leading spots, facing donk) | LOW | Medium |

### Turn (15 nodes)

Where pots get large and mistakes are expensive.

| Node Category | Nodes | Priority | Exploit Variance |
|---|---|---|---|
| **Double barrel** | 3 (favorable turn, scare card, brick) | HIGH | High (Pool B folds) |
| **Facing barrel** | 3 (call-down, raise, fold) | HIGH | High (Pool B = value-heavy) |
| **Probe bet** | 2 (when PFR checks flop) | MEDIUM | Medium |
| **Overbet** | 2 (value overbet, bluff overbet) | MEDIUM | High |
| **Facing overbet** | 2 (defend, fold) | MEDIUM | Medium |
| **Turn check-raise** | 2 (value, bluff) | MEDIUM | High |
| **Turn in 3BP** | 1 (continuing in 3-bet pot) | HIGH | Medium |

### River (15 nodes)

Largest pots, highest-stakes single decisions.

| Node Category | Nodes | Priority | Exploit Variance |
|---|---|---|---|
| **Thin value** | 3 (standard, deep stacks, multiway) | HIGH | High (Pool B calls wide) |
| **Bluff catching** | 3 (standard, facing overbet, paired board) | HIGH | Highest (core exploit spot) |
| **Bluffing** | 3 (standard, blocked, scare card) | HIGH | High (Pool B overfolds) |
| **Overbet decisions** | 2 (value overbet, bluff overbet) | MEDIUM | High |
| **Facing river raise** | 2 (value raise, bluff raise) | MEDIUM | High (Pool B never bluffs raises) |
| **River in 3BP** | 2 (value/bluff in bloated pot) | HIGH | Medium |

### Exploit-Specific Nodes (10 nodes)

Spots where the optimal play depends entirely on the opponent pool.

| Node Category | Nodes | Priority |
|---|---|---|
| **Pool B river fold spots** | 2 | HIGH — most common live exploit |
| **Pool B bluff targets** | 2 | HIGH — where to pressure passive players |
| **Pool C trap spots** | 2 | HIGH — check-raise and slowplay vs aggro |
| **Pool C call-down spots** | 2 | HIGH — widening bluff-catch range |
| **Live-specific limped pots** | 2 | MEDIUM — unique to live poker |

---

## Position Pair Priority Matrix

Ranked by frequency in live 6-max and 9-handed games:

| Rank | Matchup | Why |
|---|---|---|
| 1 | BTN vs BB | Most common HU pot |
| 2 | CO vs BB | Second most common |
| 3 | CO vs BTN | Frequent 3-bet dynamic |
| 4 | SB vs BB | Blind battle |
| 5 | BTN vs SB | 3-bet pots |
| 6 | HJ vs BB | Mid-position opens |
| 7 | UTG vs BB | EP open dynamics |
| 8 | 3-way+ | Multiway pots (very common live) |

---

## Stack Depth Considerations

Live poker has more stack depth variance than online. Nodes should consider:

| Depth | Range (BB) | Prevalence | Impact |
|---|---|---|---|
| Shallow | <40 BB | Rare in cash (tournament mentality) | Simplified ranges |
| Standard | 40-100 BB | Common | Standard strategies |
| Deep | 100-200 BB | Very common live | Wider implied odds, more speculative play |
| Ultra-deep | 200+ BB | Common in high stakes live | Fundamentally different strategies |

Priority: Standard (100 BB) first, then deep (150-200 BB) variants for key nodes.

---

## Target Scale

| Category | Nodes | Drills/Node | Base Drills | With Pool Variants |
|---|---|---|---|---|
| Preflop | 20 | 8-10 | 180 | 400+ |
| Flop | 20 | 8-10 | 180 | 450+ |
| Turn | 15 | 8-10 | 135 | 350+ |
| River | 15 | 8-10 | 135 | 350+ |
| Exploit | 10 | 6-8 | 70 | 150+ |
| **Total** | **80** | — | **~700** | **~1700** |

---

## Content Expansion Order

Phase 2 content should be authored in this order:

1. **River bluff-catching** (highest exploit variance, most impactful for live play)
2. **Flop c-betting SRP** (most frequent postflop decision)
3. **Preflop opening + facing opens** (foundation for everything)
4. **Turn barreling + facing barrels** (where pots grow)
5. **3-bet pot flop/turn/river** (increasingly common at higher stakes)
6. **River bluffing + value** (closing action, big pots)
7. **Multiway** (live-specific, underserved by competitors)
8. **Exploit-specific nodes** (pure pool-adjustment training)
9. **4-bet pots** (less frequent but high-stakes)
10. **Limped pots** (live-specific edge case)
