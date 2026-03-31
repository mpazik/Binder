---
name: binder-modeling
description: Binder data modeling — define entity types, fields, relations, and constraints. Use when asked to "create a type", "add a field", "define a schema", "set up relations", "model entities", or design a binder workspace schema.
---

# Binder Data Modeling

Schema is stored as data — types and fields are config entities that evolve through transactions.

## Core Concepts

- **Field** — first-class schema element (name, data type, constraints). Shared across types (RDF-style)
- **Type** — organizes entities and applies field constraints. Any entity can have any field
- **Transaction** — atomic changes to multiple entities. Schema changes use `binder tx import`

## Namespaces

- **Record** — user data. References use UIDs
- **Config** — schema (Fields, Types, Attributes). References use immutable keys
- **Transaction** — append-only audit log

## Defining Fields

Fields exist independently of types. Define in a transaction YAML and import with `binder tx import`:

```yaml
- author: system
  configs:
    - key: priority
      type: Field
      name: Priority
      dataType: option
      options: [low, medium, high]
      default: medium

    - key: assignee
      type: Field
      name: Assignee
      dataType: relation
      range: [User]
```

## Defining Types

Types compose fields with optional per-type constraints:

```yaml
- author: system
  configs:
    - key: Task
      type: Type
      name: Task
      fields:
        - title: { required: true }
        - status: { default: active, only: [draft, active, complete] }
        - priority
        - parent: { only: [Task] }
        - children: { only: [Task] }
```

Constraints: `required`, `default`, `only: [...]`, `exclude: [...]`.

## Relations

Use `inverseOf` for bidirectional sync. See [references/relations.md](references/relations.md) for patterns and storage details.

**1:M** — `allowMultiple` side declares `inverseOf`, single-value side stores data:
```yaml
    - key: parent
      type: Field
      dataType: relation
    - key: children
      type: Field
      dataType: relation
      allowMultiple: true
      inverseOf: parent
```

**M:M** — both sides `allowMultiple`, both store data:
```yaml
    - key: relatesTo
      type: Field
      dataType: relation
      allowMultiple: true
      inverseOf: relatesTo
```

## Attributes

Attach metadata to field values (e.g. role, percentage on a relation). Define `Attribute` config entities, then reference them from a field's `attributes` list. See [references/field-attributes.md](references/field-attributes.md) for full details.

```yaml
- author: system
  configs:
    - key: role
      type: Attribute
      dataType: string

    - key: assignedTo
      type: Field
      dataType: relation
      range: [User]
      attributes: [role]
```

## Data Types

Primitives: `string`, `text`, `richtext`, `boolean`, `integer`, `decimal`, `date`, `datetime`, `duration`, `interval`.
References: `relation`, `uri`.
Enumerations: `option`, `optionSet`.
Other: `object`, `formula`, `condition`, `image`, `fileHash`, `uid`, `seqId`.

## System Fields

Auto-managed (do not set): `id`, `uid`, `key`, `type`, `version`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`.

## Best Practices

1. Run `binder schema` and `binder schema -n config` before adding types or fields
2. Reuse fields across types — don't duplicate
3. Use `only` constraints to restrict relation targets per type
4. Always define `inverseOf` for bidirectional relations
5. Preview with `binder tx import -d` before applying

## References

- [Relations & inverse patterns](references/relations.md)
- [Field attributes](references/field-attributes.md)
