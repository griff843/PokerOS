# AI Coach Architecture

## Purpose

The AI coaching system provides interactive, conversational explanations and personalized feedback. It replaces static explanation text with a coaching experience that adapts to the player's mistakes, pool context, and learning history.

---

## Responsibilities

- Explain incorrect decisions conversationally (not just "fold is correct")
- Contrast answers across pool types ("you called, which works vs Pool C, but this is a Pool B session where they under-bluff")
- Answer concept questions during review
- Suggest study strategies based on weakness patterns
- Analyze session performance post-session
- Generate focused study recommendations from leak detection data

---

## Data Inputs

The AI coaching layer receives structured context for every interaction:

### Per-Drill Inputs

| Input | Source | Purpose |
|---|---|---|
| `prompt` | drill.prompt | The scenario the player faced |
| `scenario` | drill.scenario | Structured game state: board, hand, positions, action history |
| `correct_answer` | Resolved from `answer` or `answer_by_pool[pool]` | What the right play was |
| `user_answer` | attempt.user_answer_json | What the player chose |
| `explanation` | Resolved from `answer` or `answer_by_pool[pool]` | Static explanation text (seed for AI response) |
| `rule_tags` | answer.required_tags | Which concepts the player needed to identify |
| `missed_tags` | attempt.missed_tags_json | Which rule tags the player missed |
| `classification_tags` | drill.tags[] | What the drill is about (street, pot, concept, etc.) |
| `pool_context` | Session pool selection | Which opponent type is being trained |
| `coaching_context` | drill.coaching_context | Author-provided hints: key concept, common mistake, range context |
| `score` | attempt.score | How well the player did (0-1) |
| `elapsed_ms` | attempt.elapsed_ms | How long the decision took |

### Per-Session Inputs (post-session analysis)

| Input | Source | Purpose |
|---|---|---|
| All attempt records | Session state | Full session performance |
| Historical accuracy by tag | attempts + tags analytics | Trend data for weakness detection |
| SRS state | srs table | Which concepts are due/overdue |
| Concept mastery levels | Adaptive curriculum data | Broader learning progress |

### Pool-Contrastive Inputs

When a drill has `answer_by_pool`, the AI coach receives all three pool answers to enable contrastive explanations:

```
answer_by_pool: {
  A: { correct: "call", explanation: "..." },
  B: { correct: "fold", explanation: "..." },
  C: { correct: "call", explanation: "..." }
}
```

This allows the coach to say: "You chose call. That's correct vs Pool A and C, but you're training Pool B this session. Here's why the answer changes..."

---

## Coaching Behaviors

### Wrong Answer Explanation

AI should guide reasoning rather than simply providing answers.

**Pattern**: Start with what the player chose, explain what it implies, then teach the correct reasoning.

Example:

> "You chose call on the river facing a 75% pot bet. For a call to be profitable, villain needs to be bluffing at least ~30% of the time. Against Pool B (passive recreational), their river bets are almost always value — they under-bluff significantly. Their actual bluff frequency here is closer to 10-15%.
>
> The key concept is **paired_top_river**: the top card pairing reduces their value combos (they have fewer trips combinations), but Pool B doesn't increase their bluffing frequency to compensate. Fold is correct."

### Pool-Contrastive Explanation

When the answer differs by pool, explicitly contrast:

> "This is a great spot to see how opponent type changes the answer. Vs Pool A (competent reg), you call because they bluff enough to make you indifferent. Vs Pool C (aggressive gambler), you call because they over-bluff. But vs Pool B, you fold — they simply don't bluff here."

### Concept Reinforcement

Connect the specific drill to the broader concept:

> "This spot tests the **under-bluff exploit** against passive players. Whenever Pool B voluntarily puts money in on the river, especially with a large sizing, believe them. This pattern applies across all river spots: their big bets = big hands."

### Study Strategy Suggestions

Based on weakness patterns from the adaptive curriculum:

> "Over your last 20 sessions, you're calling too often vs Pool B on river spots (calling 70% vs target of ~35%). Consider a focused study block on river bluff-catching vs passive populations. I'd recommend revisiting nodes srp_river_bluffcatch and srp_river_facing_overbet."

---

## Implementation Notes

- The AI layer uses the Anthropic API (Claude) with structured prompts
- Each coaching interaction is a single API call with the drill context as system/user message
- The coaching feature is **opt-in per drill** — player can choose to see static explanation or request AI coaching
- Coaching responses should be concise (2-4 paragraphs max)
- The AI should never contradict the drill's `explanation` or `required_tags`
- Cost management: cache common drill contexts, use shorter model for simple explanations
