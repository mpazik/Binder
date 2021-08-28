import { setupDisplaySettingsPanel } from "./index";

export const displaySettingsPanelDark = setupDisplaySettingsPanel({
  onThemeChange: (newValue) => {
    console.log(`Changed theme to "${newValue}"`);
  },
  onLineLengthChange: (newValue) => {
    console.log(`Changed line length to "${newValue}"`);
  },
  onFontSizeChange: (newValue) => {
    console.log(`Changed font size to "${newValue}"`);
  },
})({ fontSize: "x-large", lineLength: "small", theme: "dark" });

export const displaySettingsPanelLight = setupDisplaySettingsPanel({
  onThemeChange: (newValue) => {
    console.log(`Changed theme to "${newValue}"`);
  },
  onLineLengthChange: (newValue) => {
    console.log(`Changed line length to "${newValue}"`);
  },
  onFontSizeChange: (newValue) => {
    console.log(`Changed font size to "${newValue}"`);
  },
})({ fontSize: "x-small", lineLength: "medium", theme: "light" });
