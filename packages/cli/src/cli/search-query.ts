import { fail, isErr, ok, parseJson, type Result } from "@binder/utils";

// Recognize serial predicate boundaries only; the repo still interprets each token.
// The capture identifies operators that take no value.
const predicatePrefix =
  /^(?:\$text=|[A-Za-z][A-Za-z0-9_-]*(?:!=|>=?|<=?|=|:(?:notContains|contains|notIn|in|match)=|(:notEmpty|:empty)(?=\s|$)))/;

/** Split argv predicates, leaving spaces in values unless a valid predicate follows. */
export const tokenizeSearchQuery = (parts: string[]): Result<string[]> => {
  const tokens: string[] = [];
  for (const part of parts) {
    let rest = part.trim();
    if (!predicatePrefix.test(rest)) {
      tokens.push(part);
      continue;
    }
    while (rest) {
      const match = predicatePrefix.exec(rest);
      if (!match)
        return fail(
          "invalid-search-query",
          "Expected a predicate after a quoted value or no-value operator.",
        );
      const offset = match[1] ? null : match[0].length;
      if (offset !== null && rest[offset] === '"') {
        // JSON string syntax gives quotes and backslashes one explicit escape rule.
        const quoted = rest
          .slice(offset)
          .match(/^"(?:[^"\\\r\n]|\\[^\r\n])*"/u)?.[0];
        if (!quoted)
          return fail(
            "invalid-search-query",
            "Unterminated quoted filter value. Use JSON double quotes and escapes inside the shell argument.",
          );
        const value = parseJson<string>(quoted);
        if (isErr(value)) {
          return fail(
            "invalid-search-query",
            "Invalid escape in quoted filter value. Use JSON string escapes.",
          );
        }
        const after = rest.slice(offset + quoted.length);
        if (after && !/^\s/.test(after))
          return fail(
            "invalid-search-query",
            "Expected whitespace after quoted filter value.",
          );
        tokens.push(rest.slice(0, offset) + value.data);
        rest = after.trimStart();
      } else if (offset === null) {
        const end = rest.search(/\s/);
        tokens.push(end === -1 ? rest : rest.slice(0, end));
        rest = end === -1 ? "" : rest.slice(end).trimStart();
      } else {
        let end = rest.length;
        for (const whitespace of rest.matchAll(/\s+/g)) {
          const next = whitespace.index + whitespace[0].length;
          if (next >= offset && predicatePrefix.test(rest.slice(next))) {
            end = whitespace.index;
            break;
          }
        }
        tokens.push(rest.slice(0, end));
        rest = rest.slice(end).trimStart();
      }
    }
  }
  return ok(tokens);
};
