import "./styles.css";

import { cast, link, map } from "linki";
import type { JsonHtml, View } from "linki-ui";
import { h5, input, label, dangerousHtml } from "linki-ui";

import {
  getInputTarget,
  inputValue,
} from "../../../libs/simple-ui/utils/funtions";
import { inline, inset, stack } from "../../common/spacing";
import type {
  DisplaySettings,
  FontFace,
  FontSize,
  LineHeight,
  LineLength,
  Theme,
} from "../type";

const serifIcon = () =>
  dangerousHtml(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
   <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
   <line x1="4" y1="20" x2="7" y2="20"></line>
   <line x1="14" y1="20" x2="21" y2="20"></line>
   <line x1="6.9" y1="15" x2="13.8" y2="15"></line>
   <line x1="10.2" y1="6.3" x2="16" y2="20"></line>
   <polyline points="5 20 11 4 13 4 20 20"></polyline>
</svg>`);
const sansSerifIcon = () =>
  dangerousHtml(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
   <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
   <path d="M7 20v-12a4 4 0 0 1 4 -4h2a4 4 0 0 1 4 4v12"></path>
   <line x1="7" y1="13" x2="17" y2="13"></line>
</svg>`);

const fontSizeIcon = (size = "24") =>
  dangerousHtml(`<svg xmlns="http://www.w3.org/2000/svg" class="v-align-middle" width=${size} height=${size} viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
   <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
   <circle cx="18" cy="16" r="3"></circle>
   <line x1="21" y1="13" x2="21" y2="19"></line>
   <path d="M3 19v-10a4 4 0 0 1 4 -4a4 4 0 0 1 4 4v10"></path>
   <line x1="3" y1="13" x2="11" y2="13"></line>
</svg>`);
export const typographyIcon = fontSizeIcon();

const lineLengthIcon = (width = "24") =>
  dangerousHtml(`<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" width=${width} height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
   <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
   <line x1="4" y1="6" x2="20" y2="6"></line>
   <line x1="4" y1="12" x2="20" y2="12"></line>
   <line x1="4" y1="18" x2="16" y2="18"></line>
</svg>`);

const lineHeightIcon = (height = "24") =>
  dangerousHtml(`<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" width="24" height=${height} viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
   <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
   <polyline points="3 8 6 5 9 8"></polyline>
   <polyline points="3 16 6 19 9 16"></polyline>
   <line x1="6" y1="5" x2="6" y2="19"></line>
   <line x1="13" y1="6" x2="20" y2="6"></line>
   <line x1="13" y1="12" x2="20" y2="12"></line>
   <line x1="13" y1="18" x2="20" y2="18"></line>
</svg>`);

const themeIcon = () =>
  dangerousHtml(`<svg xmlns="http://www.w3.org/2000/svg"  width=36 height="24" viewBox="0 0 36 24" stroke="none" fill="currentColor" stroke-linecap="round">
   <rect width="100%" height="100%" />
</svg>`);

const darkColor = "#0d1117";
const autoDarkThemeIcon = () =>
  dangerousHtml(`<svg xmlns="http://www.w3.org/2000/svg"  width=36 height="24" preserveAspectRatio="none"  viewBox="0 0 100 100" stroke-linecap="round">
   <polygon points="0,0 100,0 0,100" style="fill:white;stroke:none" />
   <polygon points="0,100 100,0 100,100" style="fill:${darkColor};stroke:none" />
</svg>`);

const darkDimmedColor = "#6a737d";
const autoDarkDimmedThemeIcon = () =>
  dangerousHtml(`<svg xmlns="http://www.w3.org/2000/svg"  width=36 height="24" preserveAspectRatio="none"  viewBox="0 0 100 100" stroke-linecap="round">
   <polygon points="0,0 100,0 0,100" style="fill:white;stroke:none" />
   <polygon points="0,100 100,0 100,100" style="fill:${darkDimmedColor};stroke:none" />
</svg>`);

const settingPanel = <T>({
  name,
  class: className = "",
  title,
  currentValue,
  onChange,
  data,
}: {
  name: string;
  class?: string;
  title: string;
  currentValue?: T;
  onChange: (newValue: T) => void;
  data: {
    value: T;
    content?: JsonHtml;
    title?: string;
    style?: Partial<CSSStyleDeclaration>;
  }[];
}) =>
  stack(
    { gap: "small", class: className },
    h5(title),
    inline(
      { class: "radio-group", gap: "none" },
      ...data.flatMap(({ value, content, title, style }) => {
        const id = `${name}_${value}`;
        return [
          input({
            type: "radio",
            name,
            id,
            value: (value as unknown) as string,
            onChange: link(map(getInputTarget, inputValue, cast()), onChange),
            ...(value === currentValue ? { checked: true } : {}),
          }),
          label(
            {
              for: id,
              ...(title ? { title } : {}),
              ...(style ? { style } : {}),
            },
            ...(content ? [content] : [])
          ),
        ];
      })
    )
  );

export type DisplaySettingListeners = {
  onFontFaceChange: (v: FontFace) => void;
  onFontSizeChange: (v: FontSize) => void;
  onLineLengthChange: (v: LineLength) => void;
  onLineHeightChange: (v: LineHeight) => void;
  onThemeChange: (v: Theme) => void;
};

export const setupDisplaySettingsPanel = ({
  onFontFaceChange,
  onFontSizeChange,
  onLineLengthChange,
  onLineHeightChange,
  onThemeChange,
}: DisplaySettingListeners): View<DisplaySettings> => ({
  fontFace,
  fontSize,
  lineLength,
  lineHeight,
  theme,
}) => {
  return inset(
    { size: "medium" },
    stack(
      { gap: "x-large" },
      settingPanel<FontFace>({
        name: "font-face",
        class: "font-face",
        title: "Font face",
        currentValue: fontFace,
        onChange: onFontFaceChange,
        data: [
          { value: "sans-serif", content: sansSerifIcon() },
          { value: "serif", content: serifIcon() },
        ],
      }),
      settingPanel<FontSize>({
        name: "font-size",
        title: "Font size",
        currentValue: fontSize,
        onChange: onFontSizeChange,
        data: [
          { value: "x-small", content: fontSizeIcon("14") },
          { value: "small", content: fontSizeIcon("18") },
          { value: "medium", content: fontSizeIcon("22") },
          { value: "large", content: fontSizeIcon("26") },
          { value: "x-large", content: fontSizeIcon("30") },
        ],
      }),
      settingPanel<LineLength>({
        name: "line-length",
        title: "Line length",
        currentValue: lineLength,
        onChange: onLineLengthChange,
        data: [
          { value: "x-small", content: lineLengthIcon("14") },
          { value: "small", content: lineLengthIcon("18") },
          { value: "medium", content: lineLengthIcon("22") },
          { value: "large", content: lineLengthIcon("26") },
          { value: "x-large", content: lineLengthIcon("30") },
        ],
      }),
      settingPanel<LineHeight>({
        name: "line-height",
        title: "Line height",
        class: "line-height",
        currentValue: lineHeight,
        onChange: onLineHeightChange,
        data: [
          { value: "small", content: lineHeightIcon("18") },
          { value: "medium", content: lineHeightIcon("24") },
          { value: "large", content: lineHeightIcon("30") },
        ],
      }),
      settingPanel<Theme>({
        name: "theme",
        class: "theme-group",
        title: "Appearance",
        currentValue: theme,
        onChange: onThemeChange,
        data: [
          {
            value: "light",
            title: "light",
            style: { color: "#ffffff" },
            content: themeIcon(),
          },
          {
            value: "dark-dimmed",
            title: "dimmed",
            style: { color: darkDimmedColor },
            content: themeIcon(),
          },
          {
            value: "dark",
            title: "dark",
            style: { color: darkColor },
            content: themeIcon(),
          },
          {
            value: "auto-dark-dimmed",
            title: "auto - sync with you OS color mode",
            content: autoDarkDimmedThemeIcon(),
          },
          {
            value: "auto-dark",
            title: "auto - sync with you OS color mode",
            content: autoDarkThemeIcon(),
          },
        ],
      })
    )
  );
};
