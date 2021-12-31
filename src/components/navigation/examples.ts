import type { JsonHtml } from "linki-ui";
import { div } from "linki-ui";

import { appNavContent, navigationView } from "./view";

export default {};

export const empty = (): JsonHtml =>
  navigationView({
    body: "Example body",
    position: "static",
  });

export const emptyWithLargeLogo = (): JsonHtml =>
  navigationView({
    body: "Example body",
    position: "static",
    productLogoSize: "large",
  });

export const appNavigation = (): JsonHtml =>
  navigationView({
    position: "static",
    body: appNavContent({
      displayConfig: false,
      searchBoxSlot: div("Search"),
      profilePanelSlot: div("Profile"),
      displaySettingsSlot: div(),
    }),
  });

export const appNavigationWithConfig = (): JsonHtml =>
  navigationView({
    position: "static",
    body: appNavContent({
      displayConfig: true,
      searchBoxSlot: div("Search"),
      profilePanelSlot: div("Profile"),
      displaySettingsSlot: div(),
    }),
  });
