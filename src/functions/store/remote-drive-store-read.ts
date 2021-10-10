import { Callback } from "linki";

import { HashUri } from "../../libs/hash";
import { handleState, mapState } from "../../libs/named-state";
import { RemoteDrive, RemoteDriverState } from "../remote-drive";

import { ResourceStoreRead } from "./local-store";

type ReaderState =
  | ["off"]
  | ["loading", { hash: HashUri; resolve: Callback<Blob | undefined> }[]]
  | ["ready", RemoteDrive["downloadResourceFileByHash"]];

export const createStatefulRemoteDriveResourceRead = (): [
  ResourceStoreRead,
  Callback<RemoteDriverState>
] => {
  let state: ReaderState = ["off"];

  return [
    async (hash) =>
      mapState<ReaderState, Promise<Blob | undefined>>(
        state,
        Promise.resolve(undefined),
        {
          loading: (queue) =>
            new Promise((resolve) => {
              queue.push({ hash, resolve });
            }),
          ready: (reader) => reader(hash),
        }
      ),
    (driveState) => {
      state = mapState<RemoteDriverState, ReaderState>(driveState, ["off"], {
        off: () => ["off"],
        loading: () =>
          mapState<ReaderState, ReaderState>(state, ["loading", []], {
            loading: () => state,
          }),
        on: (drive) => {
          const readStore = drive.downloadResourceFileByHash;
          handleState(state, {
            loading: (queue) => {
              queue.forEach(({ hash, resolve }) => {
                readStore(hash)
                  .then(resolve)
                  .catch((err) => {
                    console.log(err);
                    resolve(undefined);
                  });
              });
            },
          });
          return ["ready", readStore];
        },
      });
    },
  ];
};
