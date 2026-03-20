import { type Brand } from "@binder/utils";

export type ViewKey = Brand<string, "ViewKey">;
export const VIEW_VIEW_KEY = "__view__" as ViewKey;
export const PHRASE_VIEW_KEY = "__inline__" as ViewKey;
export const LINE_VIEW_KEY = "__line__" as ViewKey;
export const BLOCK_VIEW_KEY = "__block__" as ViewKey;
export const SECTION_VIEW_KEY = "__section__" as ViewKey;
export const DOCUMENT_VIEW_KEY = "__document__" as ViewKey;
