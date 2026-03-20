import {
  MessageType,
  ShowMessageNotification,
} from "vscode-languageserver/node";
import { isErr, ok, tryCatch, type ResultAsync } from "@binder/utils";
import { extractFileChanges } from "../../document/change-extractor.ts";
import { loadNavigation } from "../../document/navigation.ts";
import type { RuntimeContextWithDb } from "../../runtime.ts";
import type {
  WorkspaceContextDeps,
  WorkspaceEntry,
} from "../workspace-manager.ts";
import {
  getRelativeSnapshotPath,
  getSnapshotEntityUid,
  namespaceFromSnapshotPath,
} from "../../lib/snapshot.ts";

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

const notify = (
  deps: WorkspaceContextDeps,
  type: MessageType,
  message: string,
): void => {
  deps.connection.sendNotification(ShowMessageNotification.type, {
    type,
    message,
  });
};

// ---------------------------------------------------------------------------
// Document sync
// ---------------------------------------------------------------------------

type SyncResult = { changeCount: number };

const syncDocument = async (
  context: RuntimeContextWithDb,
  uri: string,
): ResultAsync<SyncResult> => {
  const { log, config, fs, kg } = context;

  const uriObj = new URL(uri);
  if (uriObj.protocol !== "file:") {
    log.warn("Ignoring non-file URI", { uri });
    return ok({ changeCount: 0 });
  }
  const absolutePath = uriObj.pathname;

  const namespace = namespaceFromSnapshotPath(absolutePath, config.paths);
  if (namespace === undefined) {
    log.debug("File outside workspace, skipping sync", {
      path: absolutePath,
      config: config.paths,
    });
    return ok({ changeCount: 0 });
  }
  const relativePath = getRelativeSnapshotPath(absolutePath, config.paths);
  log.info("Syncing file", { relativePath });

  const navResult = await loadNavigation(kg, namespace);
  if (isErr(navResult)) return navResult;

  const schemaResult = await kg.getSchema(namespace);
  if (isErr(schemaResult)) return schemaResult;

  const viewsResult = await context.views();
  if (isErr(viewsResult)) return viewsResult;

  const syncResult = await extractFileChanges(
    fs,
    kg,
    config,
    navResult.data,
    schemaResult.data,
    relativePath,
    namespace,
    viewsResult.data,
    undefined,
    getSnapshotEntityUid(context.db, relativePath),
  );
  if (isErr(syncResult)) return syncResult;

  if (syncResult.data.length === 0) {
    log.info("No changes detected", { relativePath });
    return ok({ changeCount: 0 });
  }

  log.debug("Changesets to apply", { changesets: syncResult.data });

  const changesetKey = namespace === "config" ? "configs" : "records";
  const applyResult = await kg.update({
    author: config.author,
    [changesetKey]: syncResult.data,
  });
  if (isErr(applyResult)) return applyResult;

  const changeCount = syncResult.data.length;
  log.info("File synced successfully", { relativePath, changeCount });

  return ok({ changeCount });
};

// ---------------------------------------------------------------------------
// Per-URI save coalescing
//
// At most one sync runs per URI at a time. Saves arriving while a sync is
// in-flight set a pending flag; when the current sync finishes, a single
// re-sync runs with the latest disk content, preventing duplicate transactions.
// ---------------------------------------------------------------------------

type UriState = { running: boolean; pending: boolean };

const uriStates = new Map<string, UriState>();

const executeSave = async (
  context: RuntimeContextWithDb,
  uri: string,
  state: UriState,
  deps: WorkspaceContextDeps,
): Promise<void> => {
  state.running = true;
  state.pending = false;

  const result = await tryCatch(() => syncDocument(context, uri));
  if (isErr(result)) {
    context.log.error("Save sync failed", { uri, error: result.error });
    notify(deps, MessageType.Error, `Sync failed: ${result.error}`);
  } else if (isErr(result.data)) {
    context.log.error("Sync failed", { uri, error: result.data.error });
    notify(
      deps,
      MessageType.Error,
      `Sync failed: ${result.data.error.message}`,
    );
  } else if (result.data.data.changeCount > 0) {
    const { changeCount } = result.data.data;
    const s = changeCount === 1 ? "" : "s";
    notify(deps, MessageType.Info, `Synced ${changeCount} change${s}`);
  }

  state.running = false;

  if (state.pending) {
    context.log.info("Re-syncing after queued save", { uri });
    void executeSave(context, uri, state, deps);
    return;
  }

  uriStates.delete(uri);
};

// ---------------------------------------------------------------------------
// Public handler
//
// Doesn't use withDocumentContext/LspHandler because it runs its own
// extraction pipeline via extractFileChanges. The DocumentContext built by
// withDocumentContext would be redundant work discarded by the sync path.
// ---------------------------------------------------------------------------

export const handleDocumentSave = async (
  event: { document: { uri: string } },
  workspace: WorkspaceEntry,
  deps: WorkspaceContextDeps,
): Promise<void> => {
  const uri = event.document.uri;
  let state = uriStates.get(uri);

  if (!state) {
    state = { running: false, pending: false };
    uriStates.set(uri, state);
  }

  if (state.running) {
    workspace.runtime.log.info("Save queued, sync already in progress", {
      uri,
    });
    state.pending = true;
    return;
  }

  void executeSave(workspace.runtime, uri, state, deps);
};
