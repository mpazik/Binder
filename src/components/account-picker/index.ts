import { link, map, push } from "linki";
import type { JsonHtml, UiComponent, View } from "linki-ui";
import {
  a,
  button,
  dangerousHtml,
  div,
  h3,
  p,
  setupView,
  span,
} from "linki-ui";

import { blanket } from "../common/blanket";
import { centerLoading } from "../common/center-loading-component";
import { stack } from "../common/spacing";

const gdriveLogoIcon = dangerousHtml(`
<svg xmlns="http://www.w3.org/2000/svg" class="v-align-middle" width="25" height="22" viewBox="0 0 1443.061 1249.993" role="img">
  <title>Google Drive</title>
  <path fill="#3777e3" d="M240.525 1249.993l240.492-416.664h962.044l-240.514 416.664z"/>
  <path fill="#ffcf63" d="M962.055 833.329h481.006L962.055 0H481.017z" />
  <path fill="#11a861" d="M0 833.329l240.525 416.664 481.006-833.328L481.017 0z"/>
</svg>
`);

const modalFrame = (...content: JsonHtml[]) =>
  div(
    div(
      {
        class: "Popover Box color-shadow-extra-large",
        style: {
          left: "50%",
          top: "100px",
          transform: "translateX(-50%)",
          width: "280px",
        },
      },
      div(
        { class: "Box-header" },
        h3({ class: "Box-title" }, "Select your cloud drive")
      ),
      ...content
    ),
    blanket({
      style: {
        "z-index": "1",
        opacity: "0.3",
        color: "white",
        background: "black",
      },
      onClick: (e) => {
        e.preventDefault();
      },
    })
  );

const modalView: View<{
  gdriveLogin: () => void;
  closeModal: () => void;
  loading: boolean;
}> = ({ gdriveLogin, closeModal, loading }) =>
  modalFrame(
    stack(
      { class: "Box-body", gap: "large" },
      p(
        { class: "f4 mb-0" },
        "Sign In to your cloud storage provider to synchronize your data"
      ),
      ...(loading ? [centerLoading()] : []),
      button(
        { class: "btn f3", onClick: gdriveLogin, disabled: loading },
        span(gdriveLogoIcon),
        span(
          { class: "v-align-middle color-text-secondary px-2" },
          "Google Drive"
        )
      ),
      p(
        "Only google drive is supported right now. If you would like to use different cloud storage, please let us know on ",
        a(
          {
            href:
              "https://github.com/mpazik/docland/issues?q=is%3Aissue+is%3Aopen+label%3Acloud-drive",
          },
          "GitHub issue"
        ),
        "."
      )
    ),
    div(
      { class: "Box-footer text-right p-2" },
      button(
        {
          class: "btn btn-sm btn-secondary",
          onClick: closeModal,
          disabled: loading,
        },
        "Skip"
      )
    )
  );

export const accountPicker: UiComponent<
  { displayAccountPicker: { loading: boolean }; closeAccountPicker: void },
  { gdriveLogin: void }
> = ({ gdriveLogin, render }) => {
  const closeModal = link(push(undefined), render);
  const renderModal = link(
    map(setupView(modalView, { gdriveLogin, closeModal })),
    render
  );

  return {
    displayAccountPicker: renderModal,
    closeAccountPicker: closeModal,
  };
};
