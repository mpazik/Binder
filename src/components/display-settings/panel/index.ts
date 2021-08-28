import "./styles.css";

import { link, map, cast } from "linki";

import { SimplifiedElementsMap } from "../../../libs/simple-ui/dom";
import {
  fragment,
  h5,
  input,
  label,
  ViewSetup,
} from "../../../libs/simple-ui/render";
import {
  getInputTarget,
  inputValue,
} from "../../../libs/simple-ui/utils/funtions";
import { inline, inset, stack } from "../../common/spacing";
import { dropdown } from "../../navigation/common";
import { DisplaySettings, FontSize, LineLength, Theme } from "../index";

const getTypographyIcon = (size = "24") => `
<svg xmlns="http://www.w3.org/2000/svg" class="v-align-middle" width=${size} height=${size} viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
   <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
   <circle cx="18" cy="16" r="3"></circle>
   <line x1="21" y1="13" x2="21" y2="19"></line>
   <path d="M3 19v-10a4 4 0 0 1 4 -4a4 4 0 0 1 4 4v10"></path>
   <line x1="3" y1="13" x2="11" y2="13"></line>
</svg>`;
export const typographyIcon = getTypographyIcon();

const getTextIcon = (width = "24") => `
<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" width=${width} height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
   <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
   <line x1="4" y1="6" x2="20" y2="6"></line>
   <line x1="4" y1="12" x2="20" y2="12"></line>
   <line x1="4" y1="18" x2="16" y2="18"></line>
</svg>`;

const getThemeIcon = () => `
<svg xmlns="http://www.w3.org/2000/svg"  width=36 height="24" viewBox="0 0 36 24" stroke="none" fill="currentColor" stroke-linecap="round">
   <rect width="100%" height="100%" />
</svg>`;
const getAutoThemeIcon = () => `
<svg xmlns="http://www.w3.org/2000/svg"  width=36 height="24" preserveAspectRatio="none"  viewBox="0 0 100 100" stroke-linecap="round">
   <polygon points="0,0 100,0 0,100" style="fill:white;stroke:none" />
   <polygon points="0,100 100,0 100,100" style="fill:#444d56;stroke:none" />
</svg>`;

const settingPanel = <T, E = void>({
  name,
  class: className = "",
  title,
  currentValue,
  onChange,
  data,
  labelProps = () => ({}),
}: {
  name: string;
  class?: string;
  title: string;
  currentValue?: T;
  onChange: (newValue: T) => void;
  data: { value: T; text?: string; extra?: E }[];
  labelProps?: (extra: E) => Partial<SimplifiedElementsMap["label"]>;
}) =>
  stack(
    { gap: "small", class: className },
    h5(title),
    inline(
      { class: "radio-group", gap: "none" },
      ...data.map(({ value, extra, text }) => {
        const id = `${name}_${value}`;
        return fragment(
          input({
            type: "radio",
            name,
            id,
            value,
            onChange: link(map(getInputTarget, inputValue, cast()), onChange),
            ...(value === currentValue ? { checked: true } : {}),
          }),
          label(
            {
              for: id,
              ...(extra ? labelProps(extra) : {}),
            },
            ...(text ? [text] : [])
          )
        );
      })
    )
  );

export const setupDisplaySettingsPanel: ViewSetup<
  {
    onFontSizeChange: (v: FontSize) => void;
    onLineLengthChange: (v: LineLength) => void;
    onThemeChange: (v: Theme) => void;
  },
  DisplaySettings
> = ({ onFontSizeChange, onLineLengthChange, onThemeChange }) => ({
  fontSize,
  lineLength,
  theme,
}) =>
  inset(
    { size: "medium" },
    stack(
      { gap: "x-large" },
      settingPanel<FontSize, string>({
        name: "font-size",
        title: "Font size",
        currentValue: fontSize,
        onChange: onFontSizeChange,
        data: [
          { value: "x-small", extra: "14" },
          { value: "small", extra: "18" },
          { value: "medium", extra: "22" },
          { value: "large", extra: "26" },
          { value: "x-large", extra: "30" },
        ],
        labelProps: (size) => ({
          dangerouslySetInnerHTML: getTypographyIcon(size),
        }),
      }),
      settingPanel<LineLength, string>({
        name: "line-length",
        title: "Line length",
        currentValue: lineLength,
        onChange: onLineLengthChange,
        data: [
          { value: "x-small", extra: "14" },
          { value: "small", extra: "18" },
          { value: "medium", extra: "22" },
          { value: "large", extra: "26" },
          { value: "x-large", extra: "30" },
        ],
        labelProps: (size) => ({
          dangerouslySetInnerHTML: getTextIcon(size),
        }),
      }),
      settingPanel<Theme, [title: string, color: string]>({
        name: "theme",
        class: "theme-group",
        title: "Appearance",
        currentValue: theme,
        onChange: onThemeChange,
        data: [
          { value: "light", extra: ["light", "#ffffff"] },
          { value: "dark-dimmed", extra: ["dimmed", "#444d56"] },
          { value: "dark", extra: ["dark", "#0d1117"] },
          {
            value: "auto",
            extra: ["auto - sync with you OS color mode", "auto"],
          },
        ],
        labelProps: ([title, color]) => ({
          style: { color } as CSSStyleDeclaration,
          title,
          dangerouslySetInnerHTML:
            color === "auto" ? getAutoThemeIcon() : getThemeIcon(),
        }),
      })
    )
  );

export const displaySettings = dropdown({
  icon: typographyIcon,
  title: "display settings",
  children: [
    setupDisplaySettingsPanel({
      onThemeChange: () => {},
      onLineLengthChange: () => {},
      onFontSizeChange: () => {},
    })({ fontSize: "small", theme: "dark", lineLength: "small" }),
  ],
});
