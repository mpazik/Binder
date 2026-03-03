---
key: git-commit-conventions
title: Git Commit Conventions
tags: [ contributing ]
---

## Format

`prefix(scope): message` — scope is optional.

```
feat(auth): add SSO login flow
fix(api): handle null response from payments endpoint
wip: checkpoint before major restructure
```

## Prefixes

- `feat` — new feature or capability
- `fix` — bug fix
- `tweak` — small non-fix adjustment (UI polish, defaults, thresholds, copy, edge-case handling)
- `refactor` — restructure without behavior change
- `docs` — documentation (README, comments, guides, markdown)
- `tsdoc` — TypeScript/JSDoc type documentation (`@param`, `@returns`)
- `test` — add/update tests only
- `perf` — optimization (queries, bundle size, caching, algorithms)
- `build` — maintenance catch-all (build, CI/CD, dependencies, config, tooling)
- `agent` — AI agent behavior, prompts, or tooling
- `wip` — incomplete but pushable checkpoint

## Guidelines

- Subject line under 72 characters. Imperative mood ("add" not "added").
- Each commit should touch a single module/scope. Split cross-module changes into separate commits.
- `feat` vs `tweak`: new capability → `feat`; adjusting existing → `tweak`.
- `fix` vs `refactor`: old behavior was wrong → `fix`; code was messy → `refactor`.
