import { Consumer } from "../../libs/connections";
import { HashUri } from "../../libs/hash";
import { mapState } from "../../libs/named-state";
import { GDriveConfig } from "../gdrive/app-files";
import { GDriveState } from "../gdrive/controller";
import { findByHash, getFileContent } from "../gdrive/file";

import { ResourceStoreRead } from "./local-store";

export type GDriveStoreRead = ResourceStoreRead;

export const createGDriveStoreRead = (
  config: GDriveConfig
): GDriveStoreRead => async (hash) => {
  const authToken = config.token;
  const dirs = [config.dirs.app, config.dirs.linkedData];
  const file = await findByHash(authToken, dirs, hash);
  if (!file) {
    throw new Error(`Did not find a file for hash ${hash}`);
  }
  return getFileContent(authToken, file.fileId);
};

type GDriveStoreState =
  | ["idle"]
  | ["loading", { hash: HashUri; resolve: Consumer<Blob | undefined> }[]]
  | ["ready", GDriveStoreRead];

export const createStatefulGDriveStoreRead = (): [
  GDriveStoreRead,
  Consumer<GDriveState>
] => {
  let state: GDriveStoreState = ["idle"];

  return [
    async (hash) =>
      mapState(state, {
        idle: () => Promise.resolve(undefined),
        loading: (queue) =>
          new Promise((resolve) => {
            queue.push({ hash, resolve });
          }),
        ready: (reader) => reader(hash),
      }),
    (gdrive) => {
      state = mapState(gdrive, {
        idle: () => ["idle"],
        loading: () => ["idle"],
        error: () => ["idle"],
        disconnected: () => ["idle"],
        signedOut: () => ["idle"],
        loggingIn: () => (state[0] === "loading" ? state : ["loading", []]),
        profileRetrieving: () =>
          state[0] === "loading" ? state : ["loading", []],
        logged: ({ config }) => {
          const readStore = createGDriveStoreRead(config);
          if (state[0] === "loading") {
            state[1].forEach(({ hash, resolve }) => {
              readStore(hash)
                .then(resolve)
                .catch((err) => {
                  console.log(err);
                  resolve(undefined);
                });
            });
          }
          return ["ready", readStore];
        },
        loggingOut: () => ["idle"],
      });
    },
  ];
};
