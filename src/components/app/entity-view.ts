import type { Callback } from "linki";

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
export type EntityViewControls = {
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
