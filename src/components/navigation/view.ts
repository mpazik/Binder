import { DISPLAY_CONFIG_ENABLED } from "../../config";
import {
  button,
  dangerousHTML,
  details,
  div,
  fragment,
  JsonHtml,
  Listener,
  Slot,
  summary,
  View,
} from "../../libs/simple-ui/render";
import { productLogo, ProductLogoSize } from "../logo";

import { dropdownLink, dropdownMenu } from "./common";

export const navigationView: View<{
  onDisplay?: Listener<"display">;
  productLogoSize?: ProductLogoSize;
  body: JsonHtml;
  position?: string;
}> = ({ onDisplay, body, position = "absolute", productLogoSize }) =>
  div(
    {
      id: "navigation",
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

export const typographyIcon = `
<svg xmlns="http://www.w3.org/2000/svg" class="v-align-middle" viewBox="0 0 24 24" width="24" height="24">
  <path fill-rule="evenodd" d="M10.414 15l1.63 4.505a.75.75 0 001.411-.51l-5.08-14.03a1.463 1.463 0 00-2.75 0l-5.08 14.03a.75.75 0 101.41.51L3.586 15h6.828zm-.544-1.5L7 5.572 4.13 13.5h5.74zm5.076-3.598c.913-1.683 2.703-2.205 4.284-2.205 1.047 0 2.084.312 2.878.885.801.577 1.392 1.455 1.392 2.548v8.12a.75.75 0 01-1.5 0v-.06a3.123 3.123 0 01-.044.025c-.893.52-2.096.785-3.451.785-1.051 0-2.048-.315-2.795-.948-.76-.643-1.217-1.578-1.217-2.702 0-.919.349-1.861 1.168-2.563.81-.694 2-1.087 3.569-1.087H22v-1.57c0-.503-.263-.967-.769-1.332-.513-.37-1.235-.6-2.001-.6-1.319 0-2.429.43-2.966 1.42a.75.75 0 01-1.318-.716zM22 14.2h-2.77c-1.331 0-2.134.333-2.593.726a1.82 1.82 0 00-.644 1.424c0 .689.267 1.203.686 1.557.43.365 1.065.593 1.826.593 1.183 0 2.102-.235 2.697-.581.582-.34.798-.74.798-1.134V14.2z"></path>
</svg>`;

export const helpIcon = `
<svg xmlns="http://www.w3.org/2000/svg" class="v-align-middle" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
   <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
   <circle cx="12" cy="12" r="9"></circle>
   <line x1="12" y1="17" x2="12" y2="17.01"></line>
   <path d="M12 13.5a1.5 1.5 0 0 1 1 -1.5a2.6 2.6 0 1 0 -3 -4"></path>
</svg>`;

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
  displayConfig?: boolean;
}> = ({
  searchBoxSlot,
  profilePanelSlot,
  displayConfig = DISPLAY_CONFIG_ENABLED,
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
              details(
                { class: "dropdown details-reset details-overlay" },
                summary(
                  {
                    class: "btn-octicon",
                    role: "button",
                  },
                  dangerousHTML(typographyIcon),
                  div({ class: "dropdown-caret" })
                ),
                div(
                  { class: "dropdown-menu dropdown-menu-sw right-0" },
                  "something"
                )
              ),
            ]
          : []),
        dropdownMenu({
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
        }),
        profilePanelSlot
      )
    )
  );
