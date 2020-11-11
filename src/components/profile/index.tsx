import React from "react";

import {
  gdrive,
  GDriveState,
  initGdriveState,
} from "../../functions/gdrive/controller";
import { newStateMapper } from "../../utils/named-state";
import { useProcessor } from "../../utils/react";

const logo = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="25"
    height="22"
    viewBox="0 0 1443.061 1249.993"
  >
    <path
      fill="#3777e3"
      d="M240.525 1249.993l240.492-416.664h962.044l-240.514 416.664z"
    />
    <path fill="#ffcf63" d="M962.055 833.329h481.006L962.055 0H481.017z" />
    <path
      fill="#11a861"
      d="M0 833.329l240.525 416.664 481.006-833.328L481.017 0z"
    />
  </svg>
);

const Loading = <span>Loading...</span>;
export const ProfileView: React.FC<{
  state: GDriveState;
  login: () => void;
  logout: () => void;
}> = ({ state, login, logout }) =>
  newStateMapper<GDriveState, ReturnType<React.FC>>({
    initializing: () => Loading,
    loggingOut: () => Loading,
    loggingIn: () => Loading,
    profileRetrieving: () => Loading,
    ready: () => (
      <div className="p-2">
        <a type="button" onClick={login}>
          Sign In
        </a>{" "}
        to your cloud storage provider to synchronize your data
      </div>
    ),
    logged: (profile) => (
      <div className="d-flex" style={{ width: "100%" }}>
        <div className="p-2">{logo}</div>
        <div className="flex-auto d-flex flex-column">
          <div>{profile.user.displayName}</div>
          <div className="text-small text-gray">
            {profile.user.emailAddress}
          </div>
        </div>

        <details className="dropdown details-reset details-overlay">
          <summary className="btn-octicon" aria-haspopup="menu" role="button">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              width="16"
              height="16"
            >
              <path d="M8 9a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM1.5 9a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm13 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
            </svg>
          </summary>
          <ul className="dropdown-menu dropdown-menu-sw right-0">
            <li>
              <a className="dropdown-item" onClick={logout}>
                Logout
              </a>
            </li>
          </ul>
        </details>
      </div>
    ),
  })(state);

export const Profile: React.FC = () => {
  const [state, setAction] = useProcessor(gdrive, initGdriveState);
  return (
    <div style={{ height: "70px" }} className="d-flex flex-items-center">
      <ProfileView
        state={state}
        login={() => setAction(["login"])}
        logout={() => setAction(["logout"])}
      />
    </div>
  );
};
