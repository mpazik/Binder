import {
  BLOCK_VIEW_KEY,
  createViewEntity,
  DOCUMENT_VIEW_KEY,
  PHRASE_VIEW_KEY,
  SECTION_VIEW_KEY,
  type Views,
} from "./view-entity.ts";

export const mockTaskViewKey = "task-view";

export const mockTaskView = createViewEntity(
  mockTaskViewKey,
  `# {title}

**Status:** {status}

## Description

{description}
`,
);

export const mockPhraseView = createViewEntity(PHRASE_VIEW_KEY, `{title}`, {
  viewFormat: "phrase",
});

export const mockBlockView = createViewEntity(
  BLOCK_VIEW_KEY,
  `**{title}**\n\n{description}`,
  { viewFormat: "block" },
);

export const mockSectionView = createViewEntity(
  SECTION_VIEW_KEY,
  `### {title}\n\n{description}`,
  { viewFormat: "section" },
);

export const mockDocumentView = createViewEntity(
  DOCUMENT_VIEW_KEY,
  `# {title}

**Type:** {type}
**Key:** {key}

## Description

{description}`,
  { viewFormat: "document" },
);

export const mockPreambleView = createViewEntity(
  "task-preamble",
  `# {title}

## Description

{description}
`,
  { preamble: ["status"] },
);

export const mockPreambleStatusInBodyView = createViewEntity(
  "task-status-body",
  `# {title}

**Status:** {status}
`,
  { preamble: ["status"] },
);

export const mockDefaultViews: Views = [
  mockPhraseView,
  mockBlockView,
  mockSectionView,
  mockDocumentView,
];

export const mockViews: Views = [mockTaskView, ...mockDefaultViews];
