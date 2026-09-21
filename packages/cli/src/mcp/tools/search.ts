import { z } from "zod";
import { isErr, ok } from "@binder/utils";
import { FiltersSchema } from "@binder/repo";
import { formatNamespaceReferencesList } from "../../lib/reference.ts";
import { defineTool } from "./types.ts";

export const searchToolName = "search";

export const searchTool = defineTool({
  name: searchToolName,
  description: `Search for records in the knowledge graph using filters and pagination.

Use the 'schema' tool to see all available types and fields.`,
  parameters: z.object({
    filters: FiltersSchema.optional().describe(
      `Filters to apply to the search. Each key is a field name, and the value can be a simple value (string, number, boolean) or a complex filter object with 'op' and 'value' properties. Supported operators: eq, not, in, notIn, contains, notContains, match, lt, lte, gt, gte, range, empty
      
Filter examples:
- By type: { "type": "Task" }
- Complex filter: { "priority": { "op": "gte", "value": 5 }, "status": "done" }
- Range: { "weekPeriod": { "op": "range", "value": ["2026-W32", "2026-W37"] } }. Exactly two endpoints on a scalar numeric, date, datetime, or period field. Endpoints must match the field datatype and period format. Scalars are inclusive; use { "value": 9, "inclusive": false } for an exclusive endpoint.
      `,
    ),
    limit: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Maximum number of results to return (default: 50)"),
    after: z.string().optional().describe("Fetch results after this cursor"),
    before: z.string().optional().describe("Fetch results before this cursor"),
  }),
  annotation: {
    readOnly: true,
  },
  async execute(args, { kg }) {
    const searchResult = await kg.search({
      filters: args.filters,
      pagination: {
        limit: args.limit,
        after: args.after,
        before: args.before,
      },
    });
    if (isErr(searchResult)) return searchResult;

    const { items, pagination } = searchResult.data;

    const formatted = await formatNamespaceReferencesList(kg, items, "record");
    if (isErr(formatted)) return formatted;

    return ok({
      metadata: {
        count: formatted.data.length,
        hasNext: pagination.hasNext,
        hasPrevious: pagination.hasPrevious,
        nextCursor: pagination.nextCursor,
        previousCursor: pagination.previousCursor,
      },
      output: `Found ${formatted.data.length} record(s)`,
      structuredData: {
        items: formatted.data,
        pagination,
      },
    });
  },
});
