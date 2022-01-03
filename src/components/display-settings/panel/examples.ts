import type { JsonHtml } from "linki-ui";

import type { DisplaySettingListeners } from "./index";
import { setupDisplaySettingsPanel } from "./index";

const createLogger = (what: string) => (newValue: string) => {
  console.log(`Changed ${what} to "${newValue}"`);
};

const newVar: DisplaySettingListeners = {
  onFontSizeChange: createLogger("font face"),
  onFontFaceChange: createLogger("font size"),
  onLineLengthChange: createLogger("line length"),
  onLineHeightChange: createLogger("line height"),
  onThemeChange: createLogger("theme"),
};

export default {};

export const displaySettingsPanelDark = (): JsonHtml =>
  setupDisplaySettingsPanel(newVar)({
    fontFace: "sans-serif",
    fontSize: "x-large",
    lineLength: "small",
    lineHeight: "large",
    theme: "dark",
  });

export const displaySettingsPanelLight = (): JsonHtml =>
  setupDisplaySettingsPanel(newVar)({
    fontFace: "serif",
    fontSize: "x-small",
    lineLength: "medium",
    lineHeight: "large",
    theme: "light",
  });
