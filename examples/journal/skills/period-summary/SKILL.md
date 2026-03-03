---
name: period-summary
description: Period summary — reflect on a week/month/quarter/year.
argument-hint: "<w|m|q|y> [offset]"
disable-model-invocation: true
---

Summarize the target period.

## Context

Offset controls direction: default (0) = current period, negative = past period (e.g. -1 for previous). Use actual period dates from entries below — do NOT assume "current."

Ensure the target period exists: !`bun scripts/journal.ts $0 $1`

Target period with children: !`binder read $(bun scripts/journal.ts $0 $1 --key) -i "goal,plan,achievements,events,summary,totalScore,parent(key,goal,plan),children(key,goal,plan,achievements,events,summary,moodScore,sleepScore,foodScore,workScore,fitnessScore,totalScore,log)" --format yaml`
Previous period: !`binder read $(bun scripts/journal.ts $0 $(( ${1:-0} - 1 )) --key) -i "goal,plan,achievements,summary,totalScore,moodScore,sleepScore,foodScore,workScore,fitnessScore" --format yaml`
Next period's key: !`bun scripts/journal.ts $0 $(( ${1:-0} + 1 )) --key`

## Deliver one message (shallow → deep)

### 1. Metrics overview

Aggregate data from children:

**For weeks** (children are days):
- Average scores across the week (mood, sleep, food, work, fitness) + trend arrows (↑↓→) vs previous period
- Days with gym, no-YT streaks, etc.
- Total hours wasted (if tracked)
- Completion rate (achievements vs plan items across all days)

**For months+** (children are larger periods):
- Goal completion across children
- Key wins and recurring blockers
- Score trends if available

Present as a compact block:

**Scores avg:** Mood 6.2, Work 5.8↓, Fitness 7.5↑
**Achieved:** 22 of 35 plan items across the period
**Streaks:** Gym 4 of 7 days
**Top achievements:** Shipped frontmatter parser, new OHP PR
**Notable events:** NZ trip (unplanned), Valentine's Day, urgent planning meeting on Wed

### 2. Goal review

Compare the period's `goal` against what actually happened (from children summaries):
- Which goals saw real progress? State concretely what was done.
- Which goals stalled? Name them without judgment.
- Any unexpected wins or directions?

### 3. Plan progress

Review the period's `plan` items against children's `achievements`. List unfinished items with brief progress notes:

**Still open**
1. Launch MVP → **next** — week 3 done, week 4 pending
2. First 100 users → **next** — not started yet

Default action is **→ next** (carry to next period). For each, I can say: **→ drop** to kill it.

### 4. Achieved & Events

Aggregate `achievements` and `events` from all children into two numbered lists for the period. Plain text, no blockquotes — one per line for quick correction by number.

**Achieved** (→ written to `achievements`)
1. Shipped the frontmatter parser
2. Hit a new PR on overhead press
3. Gym 5 of 7 days

**Events** (notable things that happened that weren't part of the original plan — surprises, interruptions, but also good things)
1. Critical auth bug in prod on Tuesday — lost half a day
2. Urgent planning meeting pulled forward to Wednesday morning

Besides these, anything to add or remove?

Pre-fill from children entries. I only add what's missing or remove what doesn't deserve elevation to this level.

### 5. Patterns and reflection

Surface patterns from across the period:
- What worked consistently? What kept breaking down?
- Any insight that appeared in a child summary worth elevating?
- One or two targeted questions about the period as a whole

Not open-ended. You've read everything — ask about what's interesting or unclear.

## After my response

Correct based on my input. Max 2 follow-up questions, then write.

## Output

Use `binder update` to update the period's entry (key from context):

1. **`plan`**: keep as-is (no status markers)
2. **`achievements`**: final list of achievements for the period, elevated from children — list of strings
3. **`events`**: notable things that happened that weren't part of the original plan, elevated from children — list of strings
4. **`summary`**: a few paragraphs. **Plain paragraphs only — no sub-headers, no bullet lists.** Cover: what happened, goal progress, patterns, and threads for the next period.
5. **`totalScore`**: set if applicable (week level — average of children's totalScores)
6. **Carry-forward**: move still-open items to the next period's `plan`:
   - Use the next period's key from context
   - Ensure the target entry exists first: `bun scripts/journal.ts $0 $(( ${1:-0} + 1 ))` (auto-creates)
   - Append each item: `binder update <target-key> 'plan+=<item>'`
   - Items marked "→ drop" are not moved anywhere

## Tone and constraints

- Same as day-summary: honest friend, direct, no moralizing
- Under 10 minutes
- Pre-fill as much as possible — I only correct what's wrong
- For larger periods (quarter, year), be more strategic and less granular
- If a reflection thread is worth exploring deeper, note it and close
