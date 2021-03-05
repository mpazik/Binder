import { GDRIVE_API_KEY, GDRIVE_CLIENT_ID } from "../../config";
import { Opaque } from "../../libs/types";

const DISCOVERY_DOCS = [
  "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
];
const SCOPES = ["https://www.googleapis.com/auth/drive.file"].join(" ");
const API_SCRIPT = "https://apis.google.com/js/api.js";
const LOAD_TIMEOUT = 10000;

type AuthInstance = {
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  isSignedIn: {
    listen: (callback: (isSigned: boolean) => void) => {};
    get: () => boolean;
  };
};

export type GApi = {
  load: (api: string, callback: () => void) => void;
  client: {
    init: (data: any, a: () => void) => Promise<void>;
    drive: {
      about: { get: (params: any) => any };
    };
  };
  auth2: {
    getAuthInstance: () => AuthInstance;
  };
  auth: {
    getToken: () => {
      access_token: string;
    };
  };
};

declare global {
  interface Window {
    gapi: GApi;
  }
}
export type GoogleAuthToken = Opaque<string>;

const loadScript = () =>
  new Promise<GApi>((resolve, reject) => {
    const scriptElement = document.createElement("script");
    const timeoutId = setTimeout(() => {
      scriptElement.onload = null;
      reject(new Error("Could not load the Google API"));
    }, LOAD_TIMEOUT);

    scriptElement.onload = () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      resolve(window.gapi);
    };
    scriptElement.src = API_SCRIPT;
    document.body.appendChild(scriptElement);
  });

export const initializeGoogleDrive = async (): Promise<GApi> => {
  const gapi = await loadScript();
  await new Promise<void>((resolve) => gapi.load("client:auth2", resolve));
  await gapi.client.init(
    {
      apiKey: atob(GDRIVE_API_KEY),
      clientId: atob(GDRIVE_CLIENT_ID),
      discoveryDocs: DISCOVERY_DOCS,
      scope: SCOPES,
    },
    () => {}
  );
  return gapi;
};

export const getUserToken = (gapi: GApi): GoogleAuthToken | undefined => {
  const signedIn = gapi.auth2.getAuthInstance().isSignedIn.get();
  if (!signedIn) return;
  return gapi.auth.getToken().access_token as GoogleAuthToken;
};

export const signIn = async (gapi: GApi): Promise<void> =>
  gapi.auth2.getAuthInstance().signIn();

export const signOut = async (gapi: GApi): Promise<void> =>
  gapi.auth2.getAuthInstance().signOut();

export type GDriveUser = {
  displayName: string;
  emailAddress: string;
};

export type GDriveQuota = {
  limit: string;
  usage: string;
  usageInDrive: string;
  usageInDriveTrash: string;
};

export type GDriveUserProfile = {
  user: GDriveUser;
  storageQuota: GDriveQuota;
};

export const getUserProfile = async (gapi: GApi): Promise<GDriveUserProfile> =>
  await gapi.client.drive.about
    .get({ fields: "storageQuota,user" })
    .then((it: any) => JSON.parse(it.body));
