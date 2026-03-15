---
name: period-update
description: Mid-period check-in — adjust plan and reflect on direction.
argument-hint: "<w|m|q|y> [offset]"
disable-model-invocation: true
---

Mid-period check-in. The period is live — things have happened, things have changed. This is a space to adjust the plan, reflect on direction, or surface something that's been building. Could be a quick tweak or a real conversation. Read the room.

## Context

Ensure the target period exists: !`bun scripts/journal.ts $0 $1`

Target period with children so far:
!`binder read $(bun scripts/journal.ts $0 $1 --key) -f "key,goal,plan,achievements,events,children(key,goal,plan,achievements,summary,totalScore)" --format yaml`

Parent context:
!`binder read $(bun scripts/journal.ts $0 $1 --key) -f "parent(key,goal,plan,achievements)" --format yaml`

Previous period: !`binder read $(bun scripts/journal.ts $0 $(( ${1:-0} - 1 )) --key) -f "goal,plan,achievements,summary,totalScore" --format yaml`

## Open with a brief pulse (one message, short)

Read the period's plan, goal, and children completed so far. Deliver a compact snapshot:

- **Progress**: which plan items have seen real movement (from children's achievements/summaries)
- **Stalled**: which plan items have had no activity
- **Parent thread**: one line connecting this to the parent period's goal — are we on track at the larger scale?

If something stands out — a pattern, drift from the goal, unexpected momentum — name it in one honest line.

Then open the floor:

> "What's changed? Anything to add, drop, or rethink?"

That's it. Don't pre-fill a structured overhaul. Don't ask multiple questions. Just open space.

## Then listen

I might bring:
- New items that came up and need to go on the plan
- Items I forgot when planning that should have been there
- Items that are effectively done and should be noted
- A shift in priorities — something matters more or less than before
- A broader reflection on whether the goal still makes sense
- Frustration about pace, focus, or direction
- Something unrelated to the plan

Respond like a sharp, honest friend who has read all the context. Engage with what I actually said. If I'm adjusting the plan, help me think about what to cut — not just what to add. If I'm reflecting on direction, think with me at the parent-period level.

Push back gently if:
- The plan is getting overloaded
- The goal and the plan are drifting apart

Ask one follow-up at most per turn. Don't steer me back to logistics if I'm thinking bigger.

## When the conversation winds down

Summarize what changed:

> **Plan changes**: +added item, −dropped item, ~reworded item
> **Goal**: unchanged / revised to "..."

Confirm, then write.

## Output

Use `binder update` to update the target period's entry (key from context):

1. **`plan`**: the updated plan — full replacement with all current items (plain bullet list, no checkboxes, no status markers)
2. **`goal`**: only if revised — otherwise don't touch it
3. Do NOT touch `achievements`, `events`, `summary` — those are written at summary time

## Tone and constraints

- Listen first, structure later — match the depth of what I bring
- Quick updates should take 2 minutes. Deeper reflections can breathe but still close in under 10.
- If a thread goes deep and needs its own session, note it and close
- No aspirational padding — every plan item earns its spot
- Never moralize. Never manufacture urgency.
