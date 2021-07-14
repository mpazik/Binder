import { Consumer } from "../../libs/connections";
import { HashUri } from "../../libs/hash";
import { mapState } from "../../libs/named-state";
import { RemoteDrive, RemoteDriverState } from "../remote-drive";

import { ResourceStoreRead } from "./local-store";

type ReaderState =
  | ["off"]
  | ["loading", { hash: HashUri; resolve: Consumer<Blob | undefined> }[]]
  | ["ready", RemoteDrive["downloadResourceFileByHash"]];

export const createStatefulRemoteDriveResourceRead = (): [
  ResourceStoreRead,
  Consumer<RemoteDriverState>
] => {
  let state: ReaderState = ["off"];

  return [
    async (hash) =>
      mapState(state, {
        off: () => Promise.resolve(undefined),
        loading: (queue) =>
          new Promise((resolve) => {
            queue.push({ hash, resolve });
          }),
        ready: (reader) => reader(hash),
      }),
    (driveState) => {
      state = mapState(driveState, {
        off: () => ["off"],
        loading: () => (state[0] === "loading" ? state : ["loading", []]),
        on: (drive) => {
          const readStore = drive.downloadResourceFileByHash;
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
      });
    },
  ];
};
