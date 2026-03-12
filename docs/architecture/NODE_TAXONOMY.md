# Node Taxonomy

## Purpose

The node taxonomy defines the complete structure of poker decision spots used by the training system.

Each node represents a **specific decision context** within a hand.

Nodes act as containers for drills.

---

## Node Structure

Each node is defined by the following attributes:

- **Street** — preflop, flop, turn, river
- **Pot type** — SRP, 3BP, 4BP, limped, multiway
- **Player count** — heads-up (2) or multiway (3+)
- **Position configuration** — hero position vs villain position(s)
- **Stack depth** — effective stacks in BB (shallow/medium/deep)
- **Decision context** — the specific action being trained (c-bet, check-raise, bluff-catch, etc.)

---

## Node ID Convention

Node IDs are lowercase, descriptive, underscore-separated strings.

**Format**: `{scope}_{detail}`

**Regex**: `^[a-z0-9_]+$`

### Naming Patterns

| Category | Pattern | Examples |
|---|---|---|
| Preflop | `pf_{action}_{position}` | `pf_open_utg`, `pf_open_co`, `pf_open_btn` |
| Preflop vs | `pf_{action}_{hero}_vs_{villain}` | `pf_3bet_btn_vs_co`, `pf_defend_bb_vs_btn` |
| HU Postflop SRP | `srp_{street}_{spot}_{positions}` | `srp_flop_cbet_btn_vs_bb`, `srp_turn_probe_bb_vs_btn` |
| HU Postflop 3BP | `3bp_{street}_{spot}_{positions}` | `3bp_flop_cbet_ip`, `3bp_turn_barrel_oop` |
| HU Postflop 4BP | `4bp_{street}_{spot}` | `4bp_flop_cbet`, `4bp_turn_barrel` |
| Multiway | `mw_{street}_{spot}_{context}` | `mw_flop_cbet_squeeze`, `mw_turn_probe_3way` |

### Legacy IDs

Existing nodes (`hu_01` through `hu_10`) remain valid. New nodes should use the descriptive convention. The system supports both formats.

---

## Node Context Schema

Every node carries a `context` object with full classification data:

```
context: {
  player_count_flop: number    // 2 = heads-up, 3+ = multiway
  position: string             // "BTN vs BB", "CO vs BTN", "IP", "OOP"
  street: string               // "preflop", "flop", "turn", "river"
  pot_type: string             // "SRP", "3BP", "4BP", "limp", "squeeze"
  stack_depth?: string         // "shallow" (<40bb), "medium" (40-150bb), "deep" (150bb+)
  decision_type?: string       // "cbet", "check_raise", "bluff_catch", "value_bet", etc.
}
```

The node ID is a convenient label. The `context` fields carry the authoritative classification used for filtering, analytics, and curriculum planning.

---

## Node Hierarchy

### Preflop

| Spot | Description | Priority |
|---|---|---|
| Opening ranges | Open-raise vs fold by position | HIGH — most frequent decision |
| Facing open | Call, 3-bet, or fold vs an open | HIGH |
| 3-bet decisions | 3-bet construction and defense | HIGH |
| 4-bet decisions | 4-bet/fold, 4-bet/call ranges | MEDIUM |
| Squeeze decisions | Squeeze spots multiway | MEDIUM |
| Cold call | Calling opens with callers behind | MEDIUM |
| Limp pots | Limp/raise and over-limp strategy | LOW (live-specific) |

### Flop

| Spot | Description | Priority |
|---|---|---|
| C-bet (IP) | In-position c-bet strategy | HIGH |
| C-bet (OOP) | Out-of-position c-bet strategy | HIGH |
| Facing c-bet | Check-call, check-raise, fold | HIGH |
| Check-raise | Check-raise construction | MEDIUM |
| Donk bet | Leading into preflop aggressor | LOW |
| Multiway c-bet | C-bet adjustments multiway | MEDIUM |

### Turn

| Spot | Description | Priority |
|---|---|---|
| Double barrel | Continuing aggression on turn | HIGH |
| Facing barrel | Call, raise, or fold vs turn bet | HIGH |
| Probe bet | Betting when PFR checks flop | MEDIUM |
| Overbet | Polarized overbets | MEDIUM |
| Facing aggression | Responding to raises/overbets | MEDIUM |

### River

| Spot | Description | Priority |
|---|---|---|
| Thin value | Extracting value with medium-strength hands | HIGH |
| Bluff catching | Call/fold decisions vs river bets | HIGH |
| Bluffing | Constructing river bluffs | HIGH |
| Overbet | River overbets for value/bluff | MEDIUM |
| Facing overbet | Defending vs polarized river overbets | MEDIUM |

---

## Pot Types

| Pot Type | ID Prefix | Stack-to-Pot | Live Frequency |
|---|---|---|---|
| Single Raised Pot (SRP) | `srp_` | High | Very common |
| 3-Bet Pot (3BP) | `3bp_` | Medium | Common |
| 4-Bet Pot (4BP) | `4bp_` | Low | Occasional |
| Limped Pot | `limp_` | High | Common in live |
| Multiway Pot | `mw_` | Varies | Very common in live |
| Squeeze Pot | `squeeze_` | Medium | Occasional |

---

## Position Configurations

### Heads-Up Priority Matrix (by live frequency)

| Matchup | SRP | 3BP | Priority |
|---|---|---|---|
| BTN vs BB | Yes | Yes | HIGHEST |
| CO vs BB | Yes | Yes | HIGH |
| CO vs BTN | Yes | Yes | HIGH |
| SB vs BB | Yes | Yes | HIGH |
| UTG vs BB | Yes | — | MEDIUM |
| BTN vs SB | — | Yes | MEDIUM |
| HJ vs BB | Yes | — | MEDIUM |

### Multiway Configurations

- 3-way with caller (e.g., CO opens, BTN calls, BB defends)
- Squeeze pot (e.g., CO opens, BTN calls, SB squeezes)
- Limp pot multiway (e.g., 4-way limped pot)

---

## Target Scale

| Category | Node Count | Drills per Node | Total Drills |
|---|---|---|---|
| Preflop | 20 | 8-10 | 180 |
| Flop | 20 | 8-10 | 180 |
| Turn | 15 | 8-10 | 135 |
| River | 15 | 8-10 | 135 |
| Exploit-specific | 10 | 6-8 | 70 |
| **Total** | **80** | — | **~700** |

With pool variants (3x for key exploit nodes), effective drill count reaches **~1700**.

---

## Design Principles

- Nodes represent **conceptual spots**, not single hands
- Nodes should train **repeatable decision patterns**
- Nodes must remain stable even as drill content expands
- Node IDs are descriptive but the `context` fields are authoritative
- Every node should be relevant to **live mid/high stakes play**
- Prioritize by frequency: spots you face every session first
