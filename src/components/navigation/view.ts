import { DISPLAY_CONFIG_ENABLED } from "../../config";
import type {
  JsonHtml,
  Listener,
  Slot,
  View,
} from "../../libs/simple-ui/render";
import {
  button,
  dangerousHTML,
  details,
  div,
  fragment,
  nav,
  summary,
} from "../../libs/simple-ui/render";
import type { ProductLogoSize } from "../logo";
import { productLogo } from "../logo";

import { dropdownLink, dropdownMenu } from "./common";

export const navigationView: View<{
  onDisplay?: Listener<"display">;
  productLogoSize?: ProductLogoSize;
  body: JsonHtml;
  position?: string;
}> = ({ onDisplay, body, position = "absolute", productLogoSize }) =>
  nav(
    {
      class:
        "d-flex flex-justify-between flex-items-center width-full color-bg-tertiary px-2",
      style: {
        top: "0px",
        position,
        "z-index": 1,
      },
      onDisplay,
    },
    div(
      { class: "flex-1 my-2" },
      productLogo({ size: productLogoSize, beta: true })
    ),
    body
  );

export const helpIcon = `
<svg xmlns="http://www.w3.org/2000/svg" class="v-align-middle" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
   <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
   <circle cx="12" cy="12" r="9"></circle>
   <line x1="12" y1="17" x2="12" y2="17.01"></line>
   <path d="M12 13.5a1.5 1.5 0 0 1 1 -1.5a2.6 2.6 0 1 0 -3 -4"></path>
</svg>`;

const helpMenu = dropdownMenu({
  icon: helpIcon,
  children: [
    dropdownLink({
      text: "Report bug",
      href:
        "https://github.com/mpazik/docland/issues?q=is%3Aissue+is%3Aopen+label%3Abug",
    }),
    dropdownLink({
      text: "Request feature",
      href:
        "https://github.com/mpazik/docland/issues?q=is%3Aissue+is%3Aopen+label%3Aenhancement",
    }),
    dropdownLink({
      text: "Join online chat",
      href:
        "https://discord.com/channels/876828347492073543/876831428753625129",
    }),
    dropdownLink({
      text: "Email our team",
      href: "mailto:hello@docland.app",
    }),
  ],
});

export const navigationIcon = `
<svg xmlns="http://www.w3.org/2000/svg" class="v-align-middle" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
  <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
  <line x1="4" y1="6" x2="20" y2="6"></line>
  <line x1="4" y1="12" x2="20" y2="12"></line>
  <line x1="4" y1="18" x2="20" y2="18"></line>
</svg>`;

export const zoomIn = `
<svg xmlns="http://www.w3.org/2000/svg" class="v-align-middle" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
  <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
  <circle cx="10" cy="10" r="7"></circle>
  <line x1="7" y1="10" x2="13" y2="10"></line>
  <line x1="10" y1="7" x2="10" y2="13"></line>
  <line x1="21" y1="21" x2="15" y2="15"></line>
</svg>`;

export const zoomOut = `
<svg xmlns="http://www.w3.org/2000/svg" class="v-align-middle" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
  <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
  <circle cx="10" cy="10" r="7"></circle>
  <line x1="7" y1="10" x2="13" y2="10"></line>
  <line x1="21" y1="21" x2="15" y2="15"></line>
</svg>`;

export const appNavContent: View<{
  searchBoxSlot: Slot;
  profilePanelSlot: Slot;
  displaySettingsSlot: Slot;
  displayConfig?: boolean;
}> = ({
  searchBoxSlot,
  profilePanelSlot,
  displayConfig = DISPLAY_CONFIG_ENABLED,
  displaySettingsSlot,
}) =>
  fragment(
    div(
      { class: "flex-auto mx-auto my-2", style: { maxWidth: "500px" } },
      searchBoxSlot
    ),
    div(
      { class: "flex-1 d-flex flex-sm-row-reverse" },
      div(
        { class: "d-flex" },
        ...(displayConfig
          ? [
              button({ class: "btn-octicon" }, dangerousHTML(zoomOut)),
              button({ class: "btn-octicon" }, dangerousHTML(zoomIn)),
              details(
                { class: "dropdown details-reset details-overlay" },
                summary(
                  {
                    class: "btn-octicon",
                    role: "button",
                  },
                  dangerousHTML(navigationIcon),
                  div({ class: "dropdown-caret" })
                ),
                div(
                  { class: "dropdown-menu dropdown-menu-sw right-0" },
                  "something"
                )
              ),
            ]
          : []),
        displaySettingsSlot,
        helpMenu,
        profilePanelSlot
      )
    )
  );
