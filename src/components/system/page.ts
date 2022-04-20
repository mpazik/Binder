import type { Callback } from "linki";
import type { ComponentMountOptions, JsonHtml, UiComponent } from "linki-ui";
import { mountComponent } from "linki-ui";

import type { AppContextProvider } from "../../functions/app-context";
import type { AnnotationsSubscribe } from "../../functions/indexes/annotations-index";
import type {
  CompletionSubscribe,
  SearchCompletionIndex,
} from "../../functions/indexes/completion-index";
import type { DirectoryIndex } from "../../functions/indexes/directory-index";
import type { HabitSubscribe } from "../../functions/indexes/habit-index";
import type {
  WatchHistoryIndex,
  WatchHistorySearch,
} from "../../functions/indexes/watch-history-index";
import type {
  LinkedDataStoreRead,
  LinkedDataStoreReadAll,
  LinkedDataStoreWrite,
  ResourceStoreRead,
  ResourceStoreWrite,
} from "../../functions/store/local-store";
import type { LinkedData } from "../../libs/jsonld-format";

export type LinkedDataSave = Callback<LinkedData>;
export type PageControls = {
  readAppContext: AppContextProvider;
  saveLinkedData: LinkedDataSave;
  saveLinkedDataManually: LinkedDataStoreWrite;
  readLinkedData: LinkedDataStoreRead;
  readAllLinkedData: LinkedDataStoreReadAll;
  saveResource: ResourceStoreWrite;
  readResource: ResourceStoreRead;
  search: {
    directory: DirectoryIndex["search"];
    watchHistory: WatchHistorySearch;
    watchHistoryIndex: WatchHistoryIndex;
    completable: SearchCompletionIndex;
  };
  subscribe: {
    annotations: AnnotationsSubscribe;
    completable: CompletionSubscribe;
    habits: HabitSubscribe;
  };
};

// todo - find out a solution for optional context
// either page could declare what kind of context it supports or I would need to support any context and throw and error if item is not expected
// if there is no item it could display select box or be a form for a new linked data
// Personally I would prefer for page to be able to declare what it needs and handle problems globally
export type PageView = (
  controller: PageControls,
  context?: LinkedData
) => JsonHtml;

export const mountPage = (
  component: UiComponent,
  options?: ComponentMountOptions
): JsonHtml => mountComponent<void, void>(component, {}, options)[0];

export type PageBlock<T> = (controller: PageControls, context: T) => JsonHtml;

export const mountBlock = (
  component: UiComponent,
  options?: ComponentMountOptions
): JsonHtml => mountComponent<void, void>(component, {}, options)[0];
