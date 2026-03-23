---
key: cli-ui-guide
title: CLI Style
tags: [ contributing ]
---

# CLI Style

## Conventions

Follow established CLI patterns. When in doubt, check how these tools handle it: git, cargo, gh, ripgrep.
- Support `--format` for machine-readable output (json, yaml)

## stdout vs stderr

stdout is the command's answer. It's what arrives on the other end of a pipe. Use `ui.println` for output another program would consume: file paths, diagnostic lines, query results, serialized records.

stderr is everything else. Status messages, summaries, progress, decoration. Use chrome methods (`ui.success`, `ui.warning`, `ui.heading`, `ui.keyValue`, etc.) for these. They write to stderr and are suppressed by `-q`.

Errors (`ui.error`, `ui.printError`) always go to stderr and are never suppressed.

For example, `binder docs lint` prints each diagnostic line with `ui.println` (the answer) but the summary "Found 3 errors" uses `ui.warning` (status). Piping to `grep` gives you only the diagnostics.

Most commands produce no stdout at all. If you're showing a success message, a key-value pair, or a list of items, that belongs on stderr through helpers like `ui.success`, `ui.keyValue`, or `ui.list`. stdout is only for raw data meant for another program.

## Output Rules

- No Unicode symbols in output. Use `-` for bullets, plain text for labels.
- No manual spacing with `ui.println("")`. Use `ui.block()` and `ui.heading()` for layout.
- Dim labels, normal values. `ui.keyValue()` handles this automatically.

## Confirmation and Interactivity

Every mutating command falls into one of two tiers based on reversibility:
- **Immediate**: reversible via undo, or trivially recoverable. No confirmation prompt. Offer `--dry-run` when the input is complex (files, stdin, batch). Examples: `create`, `update`, `delete`, `undo`, `redo`, `tx import`, `dev reset`.
- **Protected**: irreversible, history is lost, no recovery path. In TTY: show a preview and prompt for confirmation. In non-TTY: refuse unless `--yes` is passed. Examples: `tx squash`, `tx rehash`, `tx rollback`.

Some commands are conditionally protected. `tx repair` is safe when the DB is behind the log (just replays), but destructive when the log is behind the DB (drops transactions). Prompt only in the destructive case.

### TTY Detection

- **TTY** (interactive terminal): protected commands prompt before proceeding.
- **Non-TTY** (piped, scripted, agent): protected commands print an error and exit unless `--yes` is passed. Immediate commands run without prompting.

### Flags

- `--dry-run` / `-d`: preview what would happen, do not apply. Available on commands with complex or external input. Orthogonal to confirmation: dry-run is an explicit preview mode, not a safety gate.
- `--yes` / `-y`: skip the confirmation prompt. Only meaningful on protected commands. Required in non-TTY for protected commands.

## Layout Helpers

- **`ui.block(fn)`**: wrap output with blank lines (1 before, 1 after)
- **`ui.heading(text)`**: section header with blank line before
- **`ui.keyValue(key, value)`**: dim label, normal value, 2-space indent
- **`ui.list(items, indent?)`**: bullet list with `-`
- **`ui.divider()`**: subtle horizontal line for major sections

```typescript
ui.block(() => {
  ui.keyValue("Hash", transaction.hash);
  ui.keyValue("Author", transaction.author);
});

ui.heading("Rolling back 3 transaction(s)");
ui.list(["item one", "item two"], 4);
```

## Message Functions

- **`ui.success(message)`**: green, no prefix
- **`ui.warning(message)`**: yellow with "WARNING:" prefix
- **`ui.info(message)`**: blue
- **`ui.danger(message)`**: red
- **`ui.error(message)`**: red with "Error:" prefix

```typescript
ui.block(() => {
  ui.warning("Database is behind by 3 transactions");
  ui.info("Run 'binder tx repair' to apply missing transactions");
});
ui.success("Transaction created successfully");
```
