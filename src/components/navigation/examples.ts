import { div } from "../../libs/simple-ui/render";

import { appNavContent, navigationView } from "./view";

export const emptyNavigation = navigationView({
  body: "Example body",
  position: "static",
});

export const emptyNavigationWithLargeLogo = navigationView({
  body: "Example body",
  position: "static",
  productLogoSize: "large",
});

export const appNavigation = navigationView({
  position: "static",
  body: appNavContent({
    displayConfig: false,
    searchBoxSlot: div(),
    profilePanelSlot: div(),
    displaySettingsSlot: div(),
  }),
});

export const appNavigationWithConfig = navigationView({
  position: "static",
  body: appNavContent({
    displayConfig: true,
    searchBoxSlot: div("Search box"),
    profilePanelSlot: div("P"),
    displaySettingsSlot: div(),
  }),
});
