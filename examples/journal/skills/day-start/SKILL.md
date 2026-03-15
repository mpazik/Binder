---
name: day-start
description: Morning briefing — deliver a focused briefing to start the day.
argument-hint: "[day-offset]"
disable-model-invocation: true
---

Deliver a focused morning briefing to start the day. Get me moving in under 3 minutes.

## Context

Offset controls direction: **proactive** (positive or default — briefing days ahead) or **retroactive** (negative — briefing a past day).

**Target day** = the day being briefed (offset $0). **Always read its date from the entry below — never assume it's "today."**

Ensure the target day exists: !`O=$0; bun scripts/journal.ts d ${O:-0}`

### Target day entry (we are briefing this):

!`O=$0; binder read $(bun scripts/journal.ts d ${O:-0} --key) --format yaml`

### Week context:

!`O=$0; binder read $(bun scripts/journal.ts w ${O:-0} --key) -f "weekPeriod,goal,plan,achievements" --format yaml`

### Recent days:

!`binder search type=JournalDay "dayPeriod>=$(date -v-7d +%Y-%m-%d)" -f "dayPeriod,plan,achievements,summary,moodScore,sleepScore,foodScore,workScore,fitnessScore,totalScore" --format yaml`

## Deliver the briefing FIRST (no questions)

Open with a short recap. Format:

**Previous day:** [1-2 sentence summary of what happened + key outcome]
**This week:** [week goal] — [progress based on achievements so far]
**Momentum:** [streaks, positive trends, and recent achievements, e.g. "Gym 4 days straight. Work score up from 5→7. Shipped frontmatter parser yesterday."]
**Intention:** [today's intention, if set — e.g. "Queue easy task for post-gym." If not set, omit this line.]

5 lines max. Focus on momentum and context, not rehashing failures. If the previous day was rough, acknowledge briefly and move on: "Fresh day. Here's what's ahead."

## Then ask

### 1. Sleep check

> "How did you sleep? How do you feel right now?"

Accept 1-10 or high/medium/low. Store as sleepScore if numeric.
Propose score if there are health data entires.

### 2. Plan confirmation

Show the target day's plan (already set the night before). Based on energy:

- **High energy**: "You're sharp — tackle [critical item ⭐] first."
- **Low energy**: "Start easy — [simplest task from plan]. Build into the hard stuff."

> "Does this plan still feel right, or anything to swap?"

Minimal changes only. Don't rebuild the plan.

### 3. First action

> "What will you do in the next 30 minutes?"

Must be specific. Not "work on Binder" but "open the docs PR and write the intro."

## Output

Use `binder update` to update the target day's entry (key from context):

- Set `sleepScore` if provided as number
- Append to `log`: `HH:MM - Day start. Energy: [level]. First action: [task].`
- Only update `plan` if I explicitly request a swap

## Tone and constraints

- Under 3 minutes. This is a launch pad, not a planning session.
- Energizing — like a good coach before a game. Confident in me. Brief.
- Lead with momentum, not problems
- Never guilt-trip
- Briefing is DELIVERED first, then I respond
