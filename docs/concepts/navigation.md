---
key: navigation
name: Navigation
tags: [ rendering ]
status: active
description: The configuration that materializes repository data as files on disk. Navigation items map entity queries to file paths and views, turning structured data into a browsable, editable file tree.
alternativeNames: [ navigation config, routing, rendering pipeline ]
sourceFiles:
  - packages/cli/src/document/navigation.ts
  - packages/cli/src/document/synchronizer.ts
  - packages/cli/src/lib/snapshot.ts
relatesTo: [ 115DOOPKUWE, 0ulVL40V63M, 7WvTtH5WoOs ]
---

# Navigation

## Details

### Overview

Entities in a repository are structured data. Navigation turns them into files you can browse, read, and edit. Without navigation, data lives only in the database. With it, your workspace becomes a folder of markdown and YAML files that stay in sync with the underlying entities.

Each navigation item is a config entity that specifies a file path pattern, a filter to select entities, and a view to render them. Together they define the complete file structure of a workspace.

### Navigation Item Structure

A navigation item contains:
- **path**: file path template with field interpolation like `tasks/{key}`, `milestones/{key}`
- **where**: filters that select which entities this item renders like `{ type: Task }`
- **view**: reference to a View config entity that defines rendering
- **includes**: optional field selection, controls what data is available to the view
- **query**: optional full query params for list-style rendering with embedded queries
- **children**: nested navigation items that inherit parent entity context

### File Type Inference

The system infers the output format from the navigation item:
- Path with a view → **markdown** file (`.md`)
- Path without a view → **YAML** file (`.yaml`)
- Path ending with `/` → **directory** containing child items

### Path Resolution

Path templates use `{fieldName}` interpolation. When rendering, the system resolves each entity's field values into the path, sanitising for filesystem safety:

```yaml
path: tasks/{key}          # → tasks/implement-auth.md
path: milestones/{key}     # → milestones/alpha-release.md
path: projects/{key}/       # → projects/core-platform/ (directory for children)
```

For nested navigation, child items inherit parent entity context. A child can reference parent fields in its path and query:

```yaml
- path: projects/{key}/
  where: { type: Project }
  children:
    - path: tasks/{key}
      where: { type: Task }
      view: task-view
```

### Rendering Pipeline

The full rendering flow:
1. **Load navigation**: fetch navigation items from config namespace, build tree
2. **For each item**: execute the `where` filter as a query against the entity store
3. **For each matching entity**: resolve the file path from the path pattern
4. **Render content**: apply the view (markdown) or serialise fields (YAML)
5. **Save snapshot**: write the file with version tracking metadata
6. **Recurse children**: process child navigation items with parent entity as context

### Config Navigation

The config namespace has hardcoded navigation items for system entities:
- `.binder/fields/`: field definitions
- `.binder/types/`: type definitions
- `.binder/navigation/`: navigation items themselves
- `.binder/views/{key}`: view definitions

The system's own schema is rendered and editable as files, using the same pipeline as user data.

### Entity Location Resolution

Given an entity, the system can find its file location by matching against navigation items. This powers "go to definition" in editors and entity-to-file linking. Items are scored by specificity — individual files score higher than list entries, markdown higher than YAML, simpler paths higher than deeply nested ones.

### Example

A complete workspace navigation:

```yaml
- key: nav-milestones
  type: Navigation
  path: milestones/{key}
  where: { type: Milestone }
  view: milestone-view

- key: nav-tasks
  type: Navigation
  path: tasks/{title}
  where: { type: Task }
  view: task-view

- key: nav-decisions
  type: Navigation
  path: decisions/{key}
  where: { type: Decision }
  view: decision-view
```

Each navigation item creates a file per matching entity, rendered with its view, forming the workspace's file tree.
