---
name: day-next-plan
description: Build a day plan with carry-forwards and one critical item.
argument-hint: "[source-day-offset]"
disable-model-invocation: true
---

Build the target day's plan. The source day's summary is already done — skip straight to carry-forward review.

## Context

Offset controls direction: **proactive** (positive or default — planning days ahead) or **retroactive** (negative — backfilling a past day's plan).

**Source day** = carry-forward source (offset $0).
**Target day** = day being planned (offset $0 + 1). **Always read its date from the entry below — never assume it's "tomorrow."**

Ensure the target day exists: !`O=$0; bun scripts/journal.ts d $((${O:-0} + 1))`

Source day entry (carry-forward review): !`O=$0; binder read $(bun scripts/journal.ts d ${O:-0} --key) --format yaml`
Target day entry (we are planning this): !`O=$0; binder read $(bun scripts/journal.ts d $((${O:-0} + 1)) --key) --format yaml`
Week context: !`O=$0; binder read $(bun scripts/journal.ts w ${O:-0} --key) -i "weekPeriod,goal,plan,achievements" --format yaml`
Recent days: !`binder search type=JournalDay "dayPeriod>=$(date -v-7d +%Y-%m-%d)" -i "dayPeriod,plan,achievements,summary" --format yaml`

## Flow

### 1. Carry-forward review

Present the source day's unfinished plan items (not in `achievements`). For each, ask:
- **Move to target day**
- **Schedule for later this week** → specify which day
- **Drop**

**Flag zombie tasks** — anything that's been unfinished for 3+ consecutive days:
> "This has been on your list since [date]. Commit to a specific day or kill it."

Force a decision. No silent rolling.

### 2. Week plan pull

Show items from the week plan that haven't appeared on recent day plans. Ask: "Any of these for [target day date]?"

### 3. Critical item

> "What's the ONE thing that would make [target day date] a win?"

This goes first in the plan. If I can't decide, suggest one based on week goal alignment.

### 4. Additional tasks

> "Anything else? Appointments, errands, personal?"

**Cap total plan at 6 items max.** If I go over, push back:
> "That's 8 items. You typically complete 4. Which two can wait?"

### 5. Obstacle anticipation

Based on recent log data and patterns, name one or two likely obstacles for the target day. Not a lecture — just awareness:

- "You've lost the afternoon after gym 3 of the last 4 days."
- "Wednesdays have your lowest work scores — meetings fragment the day."
- "Last two times you touched the auth code, it spiralled into 3+ hours."

Then suggest an intention — a principle to operate by for the day:

> "Intention for tomorrow? Based on the pattern, maybe something like: 'Queue an easy task for post-gym' or 'Timebox the auth fix to 2 hours.'"

One line. Not a commitment to act right now — just a guard rail to be aware of. I can accept, adjust, or skip.

### 6. Intention

If the week has an intention set, remind me of it. If not, and it's the first day of the week, suggest one.

## Output

Use `binder update` to write all agreed changes in one step — do not skip any:

1. **Target day plan** — update the target day entry (key from context) with agreed items as a single multi-line string. Can include context paragraphs (e.g. weekend notes, energy expectations) followed by a plain bullet list — no checkboxes. Critical item first, marked with ⭐.
2. **`intention`** — set the target day's intention if one was agreed. One line.
3. **Rescheduled items** — for every item moved to a future day during carry-forward review, read that day's existing plan first, then `binder update <that-day-key>` to add it. Do this immediately, not as an afterthought.

## Tone and constraints

- Ruthlessly realistic — match plan size to actual completion rate
- No aspirational fluff — every item concrete and actionable
- Zombie tasks MUST be resolved — carry with commitment, schedule, or kill
- Max 6 plan items
- Critical item always first, marked with ⭐
- Strategic, direct. Like a co-founder who respects my time.
