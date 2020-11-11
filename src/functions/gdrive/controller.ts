import {
  newStateMachineHandler,
  stateMachineWithFeedback,
} from "../../utils/named-state";

import { createProfile, GDriveProfile } from "./app-files";
import { GApi, initializeGoogleDrive, signIn, signOut } from "./auth";

type GDriveAction =
  | ["initialize", GApi]
  | ["login"]
  | ["retrieveProfile", GApi]
  | ["logout"]
  | ["loggedOut", GApi]
  | ["loggedIn", GDriveProfile];

export type GDriveState =
  | ["initializing"]
  | ["loggingIn", GApi]
  | ["profileRetrieving", GApi]
  | ["logged", GDriveProfile]
  | ["loggingOut", GApi]
  | ["ready", GApi];

export const initGdriveState: GDriveState = ["initializing"];

export const gdrive = stateMachineWithFeedback(
  initGdriveState,
  newStateMachineHandler<GDriveState, GDriveAction>({
    initializing: {
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
  }),
  {
    initializing: () =>
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
