import { Callback, fork } from "../../libs/connections";
import { filter, defined } from "../../libs/connections/filters";
import { mapState, newStateMachine } from "../../libs/named-state";
import { RepositoryDb } from "../store/repository";

import { createProfile, GDriveProfile } from "./app-files";
import { GApi, initializeGoogleDrive, signIn, signOut } from "./auth";

export type GDriveAction =
  | ["load"]
  | ["initialize", GApi]
  | ["login"]
  | ["retrieveProfile", GApi]
  | ["logout"]
  | ["loggedOut", GApi]
  | ["loggedIn", GDriveProfile]
  | ["fail", string]
  | ["push"];

export type GDriveState =
  | ["idle"]
  | ["loading"]
  | ["ready", GApi]
  | ["loggingIn", GApi]
  | ["profileRetrieving", GApi]
  | ["logged", GDriveProfile]
  | ["error", string]
  | ["loggingOut", GApi];

export const initGdriveState: GDriveState = ["idle"];

const handleError = (e: Error | unknown): GDriveAction => [
  "fail",
  (e instanceof Error ? e.message : undefined) ||
    "Unknown Error: " + JSON.stringify(e),
];

export const gdrive = (
  callback: Callback<GDriveState>,
  repositoryDb: RepositoryDb
): Callback<GDriveAction> => {
  const stateMachine = newStateMachine<GDriveState, GDriveAction>(
    initGdriveState,
    {
      idle: {
        load: () => ["loading"],
      },
      loading: {
        initialize: (gapi) => {
          return gapi.auth2.getAuthInstance().isSignedIn.get()
            ? ["profileRetrieving", gapi]
            : ["ready", gapi];
        },
        fail: (reason) => ["error", reason],
      },
      loggingIn: {
        retrieveProfile: (profile) => ["profileRetrieving", profile],
      },
      profileRetrieving: {
        loggedIn: (profile) => ["logged", profile],
        fail: (reason) => ["error", reason],
      },
      logged: {
        logout: (_, profile) => ["loggingOut", profile.gapi],
      },
      loggingOut: {
        loggedOut: (gapi) => ["ready", gapi],
      },
      ready: {
        login: (_, gapi) => {
          return ["loggingIn", gapi];
        },
      },
      error: {},
    },
    fork((state) => {
      filter<Promise<GDriveAction> | undefined, Promise<GDriveAction>>(
        defined,
        (promise: Promise<GDriveAction>) => {
          promise.then(stateMachine);
        }
      )(
        mapState<GDriveState, Promise<GDriveAction> | undefined>(state, {
          idle: () => undefined,
          loading: () =>
            initializeGoogleDrive()
              .then<GDriveAction>((gapi) => ["initialize", gapi])
              .catch(handleError),
          loggingIn: (gapi) =>
            signIn(gapi)
              .then<GDriveAction>(() => ["retrieveProfile", gapi])
              .catch(handleError),
          profileRetrieving: (gapi) =>
            createProfile(gapi, repositoryDb)
              .then<GDriveAction>((profile) => ["loggedIn", profile])
              .catch(handleError),
          logged: () => undefined,
          loggingOut: (gapi) =>
            signOut(gapi)
              .then<GDriveAction>(() => ["loggedOut", gapi])
              .catch(handleError),
          ready: () => undefined,
          error: () => undefined,
        })
      );
    }, callback)
  );
  return stateMachine;
};
