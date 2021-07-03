import { Callback, fork } from "../../libs/connections";
import { defined, filter } from "../../libs/connections/filters";
import { mapState, newStateMachine } from "../../libs/named-state";
import {
  clearLastLogin,
  DriverAccount,
  GlobalDb,
  setLastConnected,
  setLastLogin,
} from "../global-db";
import {
  openAccountRepository,
  UnclaimedRepositoryDb,
} from "../store/repository";

import {
  createGDriveConfig,
  GDriveDisconnectedProfile,
  GDriveLoadingProfile,
  GDriveLoggedOurProfile,
  GDriveProfile,
} from "./app-files";
import {
  GApi,
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
  | ["error", string]
  | ["loggingOut", GDriveLoggedOurProfile];

export const initGdriveState: GDriveState = ["idle"];

const handleError = (e: Error | unknown): GDriveAction => [
  "fail",
  (e instanceof Error ? e.message : undefined) ||
    "Unknown Error: " + JSON.stringify(e),
];

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
        fail: (reason) => ["error", reason],
      },
      loggingIn: {
        retrieveProfile: (_, context) => [
          "profileRetrieving",
          { ...context, alreadyLogged: false },
        ],
      },
      profileRetrieving: {
        loggedIn: (profile) => ["logged", profile],
        fail: (reason) => ["error", reason],
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
          loggingIn: ({ gapi }) =>
            signIn(gapi)
              .then<GDriveAction>(() => ["retrieveProfile"])
              .catch(handleError),
          profileRetrieving: async ({ gapi, repository, alreadyLogged }) => {
            try {
              const profile = await getUserProfile(gapi);
              const account: DriverAccount = {
                driver: "gdrive",
                name: profile.user.displayName,
                email: profile.user.emailAddress,
              };
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
              return handleError(error);
            }
          },
          logged: () => undefined,
          loggingOut: ({ gapi }) =>
            signOut(gapi)
              .then(() => clearLastLogin(globalDb))
              .then<GDriveAction>(() => ["loggedOut"])
              .catch(handleError),
          disconnected: () => undefined,
          signedOut: () => undefined,
          error: () => undefined,
        })
      );
    }, callback)
  );
  return stateMachine;
};
