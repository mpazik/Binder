---
key: data-type
name: Data Type
tags: [ data-model ]
status: active
description: The value format assigned to a field. Defines what values are valid, what operations apply, and how values are stored and indexed.
alternativeNames: [ field type, value type, format ]
sourceFiles:
  - packages/repo/src/model/data-type.ts
  - packages/repo/src/model/value-coercion.ts
  - packages/repo/src/data-type-validators.ts
  - packages/cli/src/utils/parse.ts
relatesTo:
  - field
  - reference
  - field-attribute
---

# Data Type

## Details

### Overview

A data type defines the format and behaviour of a field's values. While a Field says _what_ an entity can have like "assignedTo", the Data Type says _how_ that value behaves like "relation", a typed link to another entity with inverse support.

### Core Data Types

#### Identifiers

- **seqId**: sequential integer ID for entities, internal use
- **uid**: unique identifier, e.g. `tsk-abc123`

#### Primitives

- **boolean**: true/false
- **integer**: whole numbers
- **decimal**: decimal numbers
- **string**: short text values
- **text**: single-line text with optional line breaks and inline formatting
- **date**: date only, no time
- **datetime**: date with time

#### Structured

- **option**: single choice from predefined options
- **optionSet**: set of options to choose from
- **object**: complex object data

#### Specialised

- **uri**: reference to external resource, supports `uriPrefix` for template-based URLs like GitHub issue links
- **fileHash**: SHA-256 hash of a file
- **interval**: time period
- **duration**: length of time
- **image**: image URL or reference
- **formula**: computed expression evaluated from other fields, read-only
- **condition**: filter conditions

Core data types are available in all namespaces. Record entities additionally support fileHash, interval, duration, and image.

The `relation` data type turns entities into a graph. See the Reference concept for identifier strategies, inverse relations, and filtered relations. Fields can carry structured metadata via the Field Attribute concept.

### Reading Input Values

Input formats do not always give a value the type its field expects. YAML reads an unquoted `2026` as a number, and a JSON client can send `"5"` for an integer field. Binder reads each input value as the data type of its field before it validates the value. Each data type states the kind of value it stores in its definition (`valueKind`):

- **text**: `plaintext`, `richtext`, `option`, `uri`, `date`, `datetime`, `period`, `fileHash`, `interval`, `duration`, `image`. A number or boolean is read as its text. `yearPeriod: 2026` is stored as `"2026"`.
- **reference**: `relation`. Input values are read like text. Filter values keep their type, because a number in a relation filter is an entity id.
- **integer**: `seqId`, `integer`. Text that is a whole number is read as the number.
- **decimal**: `decimal`. Numeric text is read as the number.
- **boolean**: `boolean`. The text `true` or `false`, in any case, is read as the boolean.

Data types without a kind hold structured values and are not converted. Binder leaves a value that cannot be read without loss as written, such as `"abc"` for an integer field, and validation reports it.

Binder reads values wherever a field value appears: field values, list items, list mutation values, relation and patch attributes, `default` and `value` of fields and type fields, `when` conditions, and filter values in queries.

YAML loses the written text of some numbers: `007` is parsed as `7` and `1.10` as `1.1`. When a YAML number or boolean does not print as it was written (`007`, `1.10`, `0x1F`, `1e3`, `+5`, `True`), Binder keeps the written text. A text field then stores `007`, and an integer field reads it as `7`. This applies to transaction files, stdin, documents, and CLI patch values that start with `[` or `{`.
