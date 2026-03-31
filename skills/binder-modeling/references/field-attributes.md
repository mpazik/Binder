# Field Attributes

Attach structured metadata to field values without creating separate entities.

## Defining Attributes

Attributes are config entities:

```yaml
- key: role
  type: Attribute
  dataType: string

- key: percentage
  type: Attribute
  dataType: number
  min: 0
  max: 100
```

## Attaching to Fields

Reference attributes from a field definition:

```yaml
- key: assignedTo
  type: Field
  dataType: relation
  range: [User]
  attributes: [role, percentage]
```

## Usage in Records

```yaml
assignedTo:
  - user-1: { role: lead, percentage: 60 }
  - user-2: { role: reviewer, percentage: 40 }
```

## Storage

Stored flat as `fieldName.attrs` alongside the field value:

```json
{
  "assignedTo": ["user-1", "user-2"],
  "assignedTo.attrs": {
    "user-1": { "role": "lead", "percentage": 60 },
    "user-2": { "role": "reviewer", "percentage": 40 }
  }
}
```

## Best Practices

- Each Attribute defines one property (single responsibility)
- Attributes are reusable across multiple fields
- Use for relationship metadata (role, percentage, priority), not complex structures
- If >5-6 attributes, consider a separate entity type instead
