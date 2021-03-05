import { newStateMachineWithFeedback } from "../../libs/named-state";

import { createProfile, GDriveProfile } from "./app-files";
import { GApi, initializeGoogleDrive, signIn, signOut } from "./auth";

type GDriveAction =
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
  | ["ready", GApi]
  | ["loggingIn", GApi]
  | ["profileRetrieving", GApi]
  | ["logged", GDriveProfile]
  | ["error", string]
  | ["loggingOut", GApi];

export const initGdriveState: GDriveState = ["idle"];

export const gdrive = newStateMachineWithFeedback<GDriveState, GDriveAction>(
  initGdriveState,
  {
    idle: {
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
  {
    idle: () =>
      initializeGoogleDrive()
        .then<GDriveAction>((gapi) => ["initialize", gapi])
        .catch((e) => ["fail", e.details]),
    loggingIn: (gapi) =>
      signIn(gapi)
        .then<GDriveAction>(() => ["retrieveProfile", gapi])
        .catch((e) => ["fail", e.details]),
    profileRetrieving: (gapi) =>
      createProfile(gapi)
        .then<GDriveAction>((profile) => ["loggedIn", profile])
        .catch((e) => ["fail", e.details]),
    loggingOut: (gapi) =>
      signOut(gapi)
        .then<GDriveAction>(() => ["loggedOut", gapi])
        .catch((e) => ["fail", e.details]),
  }
);
