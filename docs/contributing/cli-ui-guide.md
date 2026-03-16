---
key: cli-ui-guide
title: CLI UI Guide
tags: [ contributing ]
---

### Confirmation & Interactivity

Every mutating command falls into one of two tiers based on reversibility:

**Immediate** — reversible via undo, or trivially recoverable. No confirmation
prompt. Offer `--dry-run` when the input is complex (files, stdin, batch).
Examples: `create`, `update`, `delete`, `undo`, `redo`, `tx import`, `dev reset`.

**Protected** — irreversible. History is lost, no recovery path. In TTY: show
a preview and prompt for confirmation. In non-TTY: refuse unless `--yes` is
passed. Examples: `tx squash`, `tx rehash`, `tx rollback`.

Some commands are conditionally protected. `tx repair` is safe when the DB is
behind the log (just replays), but destructive when the log is behind the DB
(drops transactions). Prompt only in the destructive case.

#### TTY detection

- **TTY** (interactive terminal): protected commands prompt before proceeding.
- **Non-TTY** (piped, scripted, agent): protected commands print an error and
  exit unless `--yes` is passed. Immediate commands always apply without
  prompting.

#### Flags

- `--dry-run` / `-d` — preview what would happen, don't apply. Available on
  commands with complex or external input (files, stdin, batch operations).
  Orthogonal to confirmation: dry-run is an explicit preview mode, not a safety
  gate.
- `--yes` / `-y` — skip the confirmation prompt. Only meaningful on protected
  commands. Required in non-TTY for protected commands. Harmless but redundant
  on immediate commands.

### Rules

- **No Unicode symbols**: Never use ✓, ✗, ⚠, ℹ, • (accessibility issues, inconsistent rendering)
- **Use `-` for bullets**: Simple hyphen, not `•`
- **No manual spacing**: Use `ui.block()` and `ui.heading()` instead of `ui.println("")`
- **Dim labels, normal values**: `ui.keyValue()` handles this automatically

### Layout Helpers

- **`ui.block(fn)`** — Wrap final output with blank lines (1 before, 1 after)

```typescript
ui.block(() => {
  ui.success("Transaction created successfully");
});
```

- **`ui.heading(text)`** — Section header with blank line before

```typescript
ui.heading("Rolling back 3 transaction(s)");
```

- **`ui.keyValue(key, value)`** — Dim label, normal value, 2-space indent

```typescript
ui.keyValue("Hash", transaction.hash);
// Renders: "  Hash: abc123..."
```

- **`ui.list(items, indent?)`** — Bullet list with `-`

```typescript
ui.list(["item one", "item two"], 4);
```

- **`ui.divider()`** — Subtle horizontal line for major sections

### Message Functions

- **`ui.success(message)`** — Green, no prefix
- **`ui.warning(message)`** — Yellow with "WARNING:" prefix
- **`ui.info(message)`** — Blue
- **`ui.danger(message)`** — Red
- **`ui.error(message)`** — Red with "Error:" prefix

### Patterns

```typescript
// Good - Command success
ui.block(() => {
  ui.printTransaction(result.data);
});
ui.success("Transaction created successfully");

// Good - Multiple transactions
ui.heading("Rolling back 3 transaction(s)");
for (const tx of transactions) {
  ui.printTransaction(tx);
  ui.println("");
}

// Good - Warning with action
ui.block(() => {
  ui.warning("Database is behind by 3 transactions");
  ui.info("Run 'binder tx repair' to apply missing transactions");
});

// Bad - manual spacing
ui.println("");
ui.success("Done");
ui.println("");

// Bad - Unicode symbols
ui.success("✓ Transaction created");
ui.warning("⚠ Database out of sync");
```
