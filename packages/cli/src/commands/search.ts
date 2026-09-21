import type { Argv } from "yargs";
import { fail, isErr, ok } from "@binder/utils";
import {
  type Includes,
  type NamespaceEditable,
  type OrderBy,
  type QueryParams,
  QueryParamsSchema,
  parseSerialFilters,
} from "@binder/repo";
import {
  type CommandHandlerReadonly,
  runtimeWithReadonlyRepo,
} from "../runtime.ts";
import { types } from "../cli/types.ts";
import {
  fieldsOption,
  limitOption,
  listFormatOption,
  namespaceOption,
  orderByOption,
} from "../cli/options.ts";
import { type SerializeFormat, flatListFormats } from "../utils/serialize.ts";
import { applySelection } from "../utils/selection.ts";
import { isStdinPiped, readStdinAs } from "../cli/stdin.ts";
import { formatNamespaceReferencesList } from "../lib/reference.ts";
import { tokenizeSearchQuery } from "../cli/search-query.ts";

const searchHandler: CommandHandlerReadonly<{
  query: string[];
  namespace: NamespaceEditable;
  format?: SerializeFormat;
  limit?: number;
  fields?: Includes;
  orderBy?: OrderBy;
}> = async ({ kg, ui, args }) => {
  let query: QueryParams;

  if (isStdinPiped()) {
    const hasArgs =
      args.query.length > 0 ||
      args.fields !== undefined ||
      args.orderBy !== undefined;

    if (hasArgs)
      return fail(
        "conflicting-input",
        "Cannot combine stdin with positional arguments or query options. Put filters, includes, and orderBy in the JSON payload instead.",
      );

    const stdinResult = await readStdinAs(QueryParamsSchema);
    if (isErr(stdinResult)) return stdinResult;

    query = {
      ...stdinResult.data,
      pagination: {
        ...stdinResult.data.pagination,
        limit: args.limit ?? stdinResult.data.pagination?.limit,
      },
    };
  } else {
    const tokens = tokenizeSearchQuery(args.query);
    if (isErr(tokens)) return tokens;
    const filters = parseSerialFilters(tokens.data);
    if (isErr(filters)) return filters;
    query = {
      filters: filters.data,
      includes: args.fields,
      orderBy: args.orderBy,
    };
  }

  const result = await kg.search(query, args.namespace);
  if (isErr(result)) return result;

  const items = applySelection(result.data.items, { limit: args.limit });
  const formatted = await formatNamespaceReferencesList(
    kg,
    items,
    args.namespace,
  );
  if (isErr(formatted)) return formatted;

  const data = flatListFormats.includes(args.format!)
    ? formatted.data
    : { ...result.data, items: formatted.data };
  ui.printData(data, args.format);

  // query_length only reported for argv queries; stdin payloads are opaque by design.
  const telemetry: Record<string, unknown> = { result_count: items.length };
  if (!isStdinPiped() && args.query.length > 0) {
    telemetry.query_length = args.query.join(" ").length;
  }
  return ok({ telemetry });
};

export const SearchCommand = types({
  command: "search [query..]",
  describe: "search using quick DSL (plain text or key=value)",
  builder: (yargs: Argv) =>
    yargs
      .positional("query", {
        describe:
          "plain text or grouped predicates (e.g. 'type=Task status=active'); quote literal values inside the argument: title=\"Discuss score>=3\"",
        type: "string",
        array: true,
        default: [],
      })
      .example(
        "$0 search 'score>=3' 'score<9'",
        "Repeated bounds form a range; same-direction bounds keep the tighter limit",
      )
      .example(
        "$0 search 'weekPeriod:range=[2026-W32,2026-W37]'",
        "Range endpoints must match a scalar number, date, datetime, or period field",
      )
      .example(
        '$0 search \'yearPeriod:range=["2024","2026"]\'',
        "Quote year endpoints inside the interval to keep them as period strings",
      )
      .epilog(
        "In range intervals, [] includes endpoints and () excludes them. Repeated equality/in values merge as alternatives. Repeated !=/notIn values merge as exclusions. Other mixed predicates on one field are errors.",
      )
      .options({
        ...namespaceOption,
        ...listFormatOption,
        ...limitOption,
        ...fieldsOption,
        ...orderByOption,
      }),
  handler: runtimeWithReadonlyRepo(searchHandler),
});
