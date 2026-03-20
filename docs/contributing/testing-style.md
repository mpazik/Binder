---
key: testing-style
title: Testing Style
tags: [ contributing ]
description: Testing conventions and patterns used across the binder codebase.
relatesTo:
  - code-style
---

# Testing Style

Binder uses the Bun test runner. Tests live alongside source files as `*.test.ts` files.

## Rules

- Test behaviour, not implementation details
- No mocking libraries. Use real implementations with in-memory backing.
- Each test should be independent and leave no state behind
- Prefer existing mock constants over inventing new inline test data
- Do not include data from debugging sessions or issue investigation in tests

## Structure

- One top-level `describe` block per file so shared setup applies to all tests
- Group related cases with nested `describe`
- Group tests by the feature they test or the shared setup they require
- Use `it` for individual assertions
- Keep test names short and descriptive without repeating the group description

```typescript
import { describe, it, expect } from "bun:test";
```

For tests that use database stores, clean up tables and reload seed data in `beforeEach`:

```typescript
beforeEach(async () => {
  await db.delete(instructionExecutionStepsTable);
  await db.delete(instructionExecutionsTable);
  await loadSeedUsers(db);
  mockLlmClient.clearResponses();
});
```

## Patterns

### Check Convention

When a `describe` group has more than two tests with the same verification shape, extract a local `check` helper. Follow the signature `check(input, expected, opts?)`.

```typescript
const check = (filters: EntityFilter, expected: RecordEntity[]) => {
  const result = filterEntities(mockEntities, filters);
  expect(result).toEqual(expected);
};

it("filters with equal operator", () => {
  check({ title: { op: "equal", value: "Task 3" } }, [mockEntities[2]]);
});
```

Add an `opts` parameter for special cases:

```typescript
const check = (
  input: ParseInput,
  expected: ParseResult,
  opts?: { strict?: boolean },
) => {
  const result = parse(input, opts);
  expect(result).toEqual(expected);
};
```

When a check helper is shared across `describe` blocks, use a descriptive name:

```typescript
const checkUserPermissions = (
  user: User,
  resource: Resource,
  expected: Permission[],
) => {
  const result = getPermissions(user, resource);
  expect(result).toEqual(expected);
};
```

### Mock Data

Each module keeps mock data in `*.mock.ts` files next to the source they relate to.
- **Data mocks** export typed constants: `mockTask1Record`, `mockProjectTypeKey`
- **Infrastructure mocks** export in-memory implementations: `createInMemoryFileSystem()`, `getTestDatabase()`, `createMockRuntimeContextWithDb()`
- Keep mock files focused. Do not add unrelated data to an existing mock file.

Spread from mock constants and override specific fields. Do not construct test objects from scratch or use real data from debugging sessions.

```typescript
import { mockTask1Record, mockUserUid } from "./record.mock.ts";

const entity = { ...mockTask1Record, title: "Custom Title" };
```

### Assertions

- Use `expect(...).toEqual(...)` for deep equality
- Use `expect(...).toMatchObject(...)` when only a subset of fields matters
- For async code use `await expect(promise).resolves.toEqual(...)`
- Use `throwIfError` when the test does not expect a failure at that point
- Use custom matchers from `@binder/utils/tests` for Result type assertions:

```typescript
import "@binder/utils/tests";

const success = throwIfError(fetchObject("key-123"));
expect(okResult).toBeOk();
expect(errorResult).toBeErrWithKey("not-found");
```

### Array Assertions

Prefer explicit comparisons. Do not use `toHaveLength` for assertions.

```typescript
// Single element
expect(result).toEqual([mockTaskEntity]);

// Matching specific properties
expect(errors).toEqual([
  expect.objectContaining({ message: "invalid type", namespace: "record" }),
  expect.objectContaining({ message: "invalid type", namespace: "config" }),
]);

// Programmatic expectations
expect(result).toEqual(
  items.map((item) => expect.objectContaining(pick(item, ["id", "title"]))),
);
```

### Object Assertions

Use `toEqual` or `toMatchObject`. Do not check individual properties manually with separate `expect` calls.

```typescript
// Exact match
expect(result).toEqual({ id: "task-1", title: "My Task", status: "pending" });

// Partial match for complex objects
expect(result).toMatchObject({ id: "task-1", title: "My Task" });

// Nested matching
expect(result).toEqual({
  task: {
    id: "task-1",
    metadata: expect.objectContaining({ createdBy: "user-1" }),
  },
  status: "success",
});
```

## End-to-End Tests

E2E tests live in `packages/cli/tests/`. They spawn real CLI or LSP processes against temporary workspaces. Use `setupWorkspace` and `teardownWorkspace` from `tests/setup.ts` for lifecycle management.

### Polling with `waitFor`

E2E tests often trigger async side-effects (background sync, event handlers) where the result is not immediately observable. Poll for the expected outcome instead of sleeping with a fixed `setTimeout`. Use `waitFor` from `@binder/utils/tests`. It retries the function until it stops throwing or the timeout expires.

```typescript
import { waitFor } from "@binder/utils/tests";

client.saveDocument(uri);

await waitFor(async () => {
  const result = await run(["read", "my-record", "--format", "json"], { cwd: dir });
  expect(result.exitCode).toBe(0);
  expect(JSON.parse(result.stdout)).toMatchObject({ title: "Updated Title" });
});
```

Pass `timeout` and `interval` to tune polling (defaults: 5000ms timeout, 100ms interval):

```typescript
await waitFor(
  async () => {
    const status = await getJobStatus(jobId);
    expect(status).toBe("complete");
  },
  { timeout: 10_000, interval: 250 },
);
```
