import type { Callback } from "linki";
import { fork, link, defined, filter, map } from "linki";

import { newStateMapper, newStateMachine } from "../../libs/named-state";
import type { GlobalDb } from "../global-db";
import { clearLastLogin, setLastConnected, setLastLogin } from "../global-db";
import type { UnclaimedRepositoryDb } from "../store/repository";
import { openAccountRepository } from "../store/repository";

import type {
  GDriveDisconnectedProfile,
  GDriveLoadingProfile,
  GDriveLoggedOurProfile,
  GDriveProfile,
} from "./app-files";
import { createGDriveConfig } from "./app-files";
import type { GApi } from "./auth";
import {
  gdriveUserToAccount,
  getUserProfile,
  initializeGoogleDrive,
  signIn,
  signOut,
} from "./auth";

export type GDriveAction =
  | ["load", GDriveLoadingProfile]
  | ["initialize", GApi]
  | ["login"]
  | ["retrieveProfile"]
  | ["logout"]
  | ["loggedOut"]
  | ["loggedIn", GDriveProfile]
  | ["fail", string]
  | ["push"];

export type GDriveState =
  | ["idle"]
  | ["loading", GDriveLoadingProfile]
  | ["disconnected", GDriveDisconnectedProfile]
  | ["signedOut", GDriveLoggedOurProfile]
  | ["loggingIn", GDriveLoggedOurProfile]
  | ["profileRetrieving", GDriveLoggedOurProfile & { alreadyLogged: boolean }]
  | ["logged", GDriveProfile]
  | ["loadingError", { error: string }]
  | ["loggingInError", GDriveLoggedOurProfile & { error: string }]
  | ["loggingOut", GDriveLoggedOurProfile];

export const initGdriveState: GDriveState = ["idle"];

const handleError = (e: Error | unknown): GDriveAction => {
  console.error("Gdrive error", e);
  const message =
    typeof e === "string" ? e : e instanceof Error ? e.message : "";
  return ["fail", message];
};

// this become more than just gdrive. It controls the current repository
export const gdrive = (
  callback: Callback<GDriveState>,
  globalDb: GlobalDb,
  unclaimedRepository: UnclaimedRepositoryDb
): Callback<GDriveAction> => {
  const stateMachine = newStateMachine<GDriveState, GDriveAction>(
    initGdriveState,
    {
      idle: {
        load: (loadingProfile) => ["loading", loadingProfile],
      },
      loading: {
        initialize: (gapi, { repository, user }) => {
          return gapi.auth2.getAuthInstance().isSignedIn.get()
            ? ["profileRetrieving", { gapi, repository, alreadyLogged: true }]
            : user
            ? [
                "disconnected",
                {
                  gapi,
                  user,
                  repository,
                },
              ]
            : ["signedOut", { gapi, repository }];
        },
        fail: (error) => ["loadingError", { error }],
      },
      loggingIn: {
        retrieveProfile: (_, context) => [
          "profileRetrieving",
          { ...context, alreadyLogged: false },
        ],
      },
      profileRetrieving: {
        loggedIn: (profile) => ["logged", profile],
        fail: (error, profile) => ["loggingInError", { error, ...profile }],
      },
      logged: {
        logout: (_, { gapi }) => [
          "loggingOut",
          { gapi, repository: unclaimedRepository },
        ],
      },
      loggingOut: {
        loggedOut: (_, profile) => ["signedOut", profile],
      },
      disconnected: {
        login: (_, profile) => {
          return ["loggingIn", profile];
        },
      },
      signedOut: {
        login: (_, profile) => {
          return ["loggingIn", profile];
        },
      },
      loadingError: {},
      loggingInError: {
        login: (_, profile) => {
          return ["loggingIn", profile];
        },
      },
    }
  )(
    fork(
      link(
        map(
          newStateMapper<GDriveState, Promise<GDriveAction> | undefined>(
            undefined,
            {
              loading: () =>
                initializeGoogleDrive()
                  .then<GDriveAction>((gapi) => ["initialize", gapi])
                  .catch(handleError),
              loggingIn: ({ gapi }) =>
                signIn(gapi)
                  .then<GDriveAction>(() => ["retrieveProfile"])
                  .catch(handleError),
              profileRetrieving: async ({
                gapi,
                repository,
                alreadyLogged,
              }) => {
                try {
                  const profile = await getUserProfile(gapi);
                  const account = gdriveUserToAccount(profile.user);
                  if (alreadyLogged) {
                    await setLastConnected(globalDb);
                  } else {
                    await setLastLogin(globalDb, account);
                  }
                  return [
                    "loggedIn",
                    {
                      gapi,
                      repository: alreadyLogged
                        ? repository
                        : await openAccountRepository(account),
                      config: await createGDriveConfig(gapi, repository),
                      ...profile,
                    },
                  ];
                } catch (error) {
                  if (error.status === 403) {
                    return handleError("insufficient-permission");
                  }
                  return handleError(error);
                }
              },
              loggingOut: ({ gapi }) =>
                signOut(gapi)
                  .then(() => clearLastLogin(globalDb))
                  .then<GDriveAction>(() => ["loggedOut"])
                  .catch(handleError),
            }
          )
        ),
        filter<Promise<GDriveAction> | undefined, Promise<GDriveAction>>(
          defined
        ),
        (promise: Promise<GDriveAction>) => {
          promise.then(stateMachine);
        }
      ),
      callback
    )
  );
  return stateMachine;
};
