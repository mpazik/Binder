---
key: git-commit-conventions
title: Git Commit Conventions
tags: [ contributing ]
---

Follows [Conventional Commits](https://www.conventionalcommits.org/) with a custom prefix set.

## Rules

- Subject line under 72 characters. Imperative mood ("add" not "added").
- Each commit should be self-contained and deployable. No broken intermediate states.
- One logical change per commit. Scope reflects the primary module, even when the change touches other modules.
- Descriptions are optional. Skip them for small or self-explanatory commits.
- When included, explain why, not what. Keep it to a few sentences. The diff shows what changed.

## Format

`prefix(scope): message` -- scope is optional.

```
feat(auth): add SSO login flow
fix(api): handle null response from payments endpoint
refactor(store): extract query builder from entity store
```

When a description is needed, add it after a blank line:

```
fix(cli): read from disk in LSP save handler to prevent sync oscillation

WebStorm sends didSave before didChange on external file reload,
so the in-memory buffer has stale content when the save handler runs.
Read from disk instead.
```

## Prefixes

- `feat`: new feature or capability
- `fix`: bug fix
- `tweak`: small non-fix adjustment (UI polish, defaults, thresholds, copy, edge-case handling)
- `refactor`: restructure without behavior change
- `docs`: documentation (README, comments, guides, JSDoc, markdown)
- `test`: add missing test coverage, not tests that accompany a feature or fix
- `perf`: optimization (queries, bundle size, caching, algorithms)
- `build`: maintenance catch-all (build, CI/CD, dependencies, config, tooling)
- `agent`: AI agent behavior, prompts, or tooling

When choosing between similar prefixes:
- `feat` vs `tweak`: new capability is `feat`, adjusting existing behavior is `tweak`
- `tweak` vs `fix`: code produces wrong results or fails is `fix`, the experience needs adjustment or improvement is `tweak`
- `feat`/`fix`/`tweak` include their tests. Use `test` only for adding missing coverage to existing code.
