---
key: query
name: Query
tags: [ data-access ]
status: active
description: A structured request for entities from the repository. Supports filters, nested includes, ordering, cursor-based pagination, computed fields, and full-text/vector search.
alternativeNames: [ search, filter ]
sourceFiles: [ packages/repo/src/model/query.ts, packages/repo/src/model/query-serial.ts ]
relatesTo:
  - layer
  - view
  - navigation
  - subscription
  - reactive-query
---

# Query

## Details

### Overview

A query is a structured request for entities from the repository. The format is JSON-based, designed to be schema-validatable, LLM-friendly, and expressive enough for complex data access without raw SQL. Queries drive views, navigation, CLI output, and API responses.

### Two Modes

#### Get Single Entity

Retrieve one entity by reference (UID, key, or ID) with optional field selection:

```json
{ "ref": "my-task", "includes": { "title": true, "project": { "includes": { "name": true } } } }
```

#### List Entities

Query multiple entities with filters, includes, ordering, and pagination:

```json
{ "filters": { "type": "Task", "status": "active" }, "includes": { "title": true }, "orderBy": ["!priority"], "pagination": { "limit": 20 } }
```

### Filters

Filters constrain which entities are returned. Simple equality uses direct values; complex conditions use operator objects:

**Common operators**: `eq`, `not`, `in`, `notIn`, `empty`
**String operators**: `contains`, `notContains`, `match`
**Number/date/period operators**: `lt`, `lte`, `gt`, `gte`, `range`
**Full-text**: `$text` — case-insensitive substring search across all plaintext and richtext fields (excluding identity fields and tags)

A filter value is read as the data type of the field it names, so `yearPeriod=2026` matches the period `"2026"` and `priority=3` matches the integer `3`. See the Data Type concept.

```json
{ "status": "active", "priority": { "op": "gte", "value": 3 }, "tags": { "op": "in", "value": ["urgent", "important"] } }
```

Full-text search combines with other filters using AND:

```json
{ "$text": "authentication", "type": "Task", "status": "active" }
```

#### Range

`range` takes exactly two endpoints for a scalar numeric, date, datetime, or period field. Scalars are inclusive; explicit endpoints require exactly `{ value, inclusive }`:

```json
{ "score": { "op": "range", "value": [3, { "value": 9, "inclusive": false }] } }
```

This means `3 <= score < 9`. Endpoints must match the field datatype: numbers, `IsoDate` (`YYYY-MM-DD`), `IsoTimestamp` (UTC with milliseconds), or calendar period strings. A number for a period field is read as period text, so `[2025, 2027]` works for a year period. Period endpoints must both match the field's `periodFormat`: day (default), week (`YYYY-W##`), month (`YYYY-MM`), quarter (`YYYY-Q#`), or year (`YYYY`). Fixed-format period labels are compared directly, without date conversion. Arbitrary text and null endpoints are invalid. Reversed bounds match nothing; equal bounds match only when both inclusive.

```json
{ "weekPeriod": { "op": "range", "value": ["2026-W32", "2026-W37"] } }
```

### Includes

The `includes` parameter controls which fields appear in the response. When omitted, all fields are returned. When specified, only requested fields are included. Includes nest recursively for relations, and can apply filters to related entities:

```json
{ "includes": { "title": true, "comments": { "includes": { "body": true, "author": { "includes": { "name": true } } }, "filters": { "status": "approved" } } } }
```

**Filters-only (reference-only) includes**: When a relation include has `filters` but no nested `includes`, it acts as a reference-only include. The resolver collapses matching related entities to their uid strings and drops any that don't match the filters:

```json
{ "includes": { "title": true, "tasks": { "filters": { "status": "active" } } } }
```

This returns `tasks` as a flat list of uid strings for only the active tasks, rather than expanded objects. Use this form when you need to know which related entities match a condition without fetching their fields.

### Ordering and Pagination

- **orderBy**: field names with `!` prefix for descending: `["!priority", "createdAt"]`
- **pagination**: cursor-based with `limit`, `after`, `before`. Cursor-based pagination provides consistent results even when data changes between pages.

### Extensions

#### Logical Operators

`$and`, `$or`, `$not` for complex filter composition. The `$` prefix avoids collision with user field names. Root-level filters are implicitly `$and`.

#### Search

- `match`: full-text search
- `similar`: vector similarity
- `search`: hybrid combining both

#### Computed Fields

Defined in a `computed` section, calculated at query time, referenceable in filters and orderBy:
- **Aggregation**: `count`, `sum`, `avg`, `min`, `max`
- **Collection**: `concat`, `collect`
- **Boolean**: `every`, `some`
- **Temporal**: `earliest`, `latest`

Computed fields are only included in the response when explicitly listed in `includes`.

### Serial Format

A compact text representation for CLI, URLs, and views — a lossy subset of the full JSON format. Each query parameter has its own independent serial grammar:
- **Filters**: `type=Task status=done priority>=3` or `deployment issues type=Task`. Plain text tokens (without an operator) are collected into a `$text` filter for full-text search across plaintext and richtext fields. When the same field appears multiple times, compatible values (equality and `in`) are merged into a single `in` filter (e.g. `status=active status=pending` → `status:in=active,pending`). Repeated `not`/`notIn` predicates merge as exclusions. Lower and upper bounds combine into `range`; repeated bounds on the same side keep the tighter limit, with exclusive bounds winning ties. Other combinations on one field return errors rather than discarding predicates
- **Includes**: `title,status,project(title,owner(name,email))`. Parentheses for nesting
- **OrderBy**: `!priority,createdAt`

```bash
binder search type=Task status=done -f "project(title),tags" -o "!priority" --limit 20
```

Includes can filter related entities: `tasks[score>=3,score<9](title)`. The serial filter parser returns a result containing either filters or a validation error, including for nested include filters. See `binder search --help` for CLI quoting and interval syntax.

Logical operators and computed fields are proposed extensions, not currently implemented.

### Design Rationale

- **JSON format**: schema-validatable, LLM-friendly, structured for programmatic construction
- **Naming convention**: top-level fields use nouns (`filters`, `includes`, `orderBy`); operators use verbs (`count`, `match`, `contains`)
- **Nested includes**: fetch exactly what's needed in one request, including related data
- **Cursor pagination**: stable under concurrent modification, unlike offset-based
- **Serial as lossy subset**: optimised for the common case; power users use JSON
