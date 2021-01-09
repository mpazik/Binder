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
  | ["push"];

export type GDriveState =
  | ["idle"]
  | ["ready", GApi]
  | ["loggingIn", GApi]
  | ["profileRetrieving", GApi]
  | ["logged", GDriveProfile]
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
    },
    loggingIn: {
      retrieveProfile: (profile) => ["profileRetrieving", profile],
    },
    profileRetrieving: {
      loggedIn: (profile) => ["logged", profile],
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
  },
  {
    idle: () =>
      initializeGoogleDrive().then<GDriveAction>((gapi) => [
        "initialize",
        gapi,
      ]),
    loggingIn: (gapi) =>
      signIn(gapi).then<GDriveAction>(() => ["retrieveProfile", gapi]),
    profileRetrieving: (gapi) =>
      createProfile(gapi).then<GDriveAction>((profile) => [
        "loggedIn",
        profile,
      ]),
    loggingOut: (gapi) =>
      signOut(gapi).then<GDriveAction>(() => ["loggedOut", gapi]),
  }
);
