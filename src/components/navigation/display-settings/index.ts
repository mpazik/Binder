import "./styles.css";

import {
  fragment,
  h5,
  input,
  JsonHtml,
  label,
  View,
} from "../../../libs/simple-ui/render";
import { inline, inset, stack } from "../../common/spacing";
import { dropdown } from "../common";

const getTypographyIcon = (size = "24") => `
<svg xmlns="http://www.w3.org/2000/svg" class="v-align-middle" width=${size} height=${size} viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
   <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
   <circle cx="18" cy="16" r="3"></circle>
   <line x1="21" y1="13" x2="21" y2="19"></line>
   <path d="M3 19v-10a4 4 0 0 1 4 -4a4 4 0 0 1 4 4v10"></path>
   <line x1="3" y1="13" x2="11" y2="13"></line>
</svg>`;
export const typographyIcon = getTypographyIcon();

const typographyRadioButton = (id: string, size: string): JsonHtml =>
  fragment(
    input({ type: "radio", name: "font-size", id, value: id }),
    label({
      for: id,
      dangerouslySetInnerHTML: getTypographyIcon(size),
    })
  );

const getTextIcon = (width = "24") => `
<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" width=${width} height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
   <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
   <line x1="4" y1="6" x2="20" y2="6"></line>
   <line x1="4" y1="12" x2="20" y2="12"></line>
   <line x1="4" y1="18" x2="16" y2="18"></line>
</svg>`;
const lineLengthRadioButton = (id: string, width: string): JsonHtml =>
  fragment(
    input({ type: "radio", name: "line-lenght", id, value: id }),
    label({
      for: id,
      dangerouslySetInnerHTML: getTextIcon(width),
    })
  );

const getThemeIcon = () => `
<svg xmlns="http://www.w3.org/2000/svg"  width=36 height="24" viewBox="0 0 36 24" stroke="none" fill="currentColor" stroke-linecap="round">
   <rect width="100%" height="100%" />
</svg>`;
const getAutoThemeIcon = () => `
<svg xmlns="http://www.w3.org/2000/svg"  width=36 height="24" preserveAspectRatio="none"  viewBox="0 0 100 100" stroke-linecap="round">
   <polygon points="0,0 100,0 0,100" style="fill:white;stroke:none" />
   <polygon points="0,100 100,0 100,100" style="fill:#444d56;stroke:none" />
</svg>`;
const themeRadioButton = (id: string, title: string, color: string): JsonHtml =>
  fragment(
    input({ type: "radio", name: "theme", id, value: id }),
    label({
      for: id,
      style: { color },
      title,
      dangerouslySetInnerHTML:
        color === "auto" ? getAutoThemeIcon() : getThemeIcon(),
    })
  );

export const displaySettingsPanel: View<{}> = () =>
  inset(
    { size: "medium" },
    stack(
      { gap: "xlarge" },
      stack(
        { gap: "small" },
        h5("Font size"),
        inline(
          { class: "radio-group", gap: "none" },
          typographyRadioButton("font-size-1", "14"),
          typographyRadioButton("font-size-2", "18"),
          typographyRadioButton("font-size-3", "22"),
          typographyRadioButton("font-size-4", "26"),
          typographyRadioButton("font-size-5", "30")
        )
      ),
      stack(
        { gap: "small" },
        h5("Line length"),
        inline(
          { class: "radio-group", gap: "none" },
          lineLengthRadioButton("line-length-1", "14"),
          lineLengthRadioButton("line-length-2", "18"),
          lineLengthRadioButton("line-length-3", "24"),
          lineLengthRadioButton("line-length-4", "30"),
          lineLengthRadioButton("line-length-5", "36")
        )
      ),
      stack(
        { gap: "small", class: "theme-group" },
        h5("Appearance"),
        inline(
          { class: "radio-group", gap: "none" },
          themeRadioButton("theme-light", "light", "#ffffff"),
          themeRadioButton("theme-dimmed", "dimmed", "#444d56"),
          themeRadioButton("theme-dark", "dark", "#0d1117"),
          themeRadioButton(
            "theme-auto",
            "auto - sync with you OS color mode",
            "auto"
          )
        )
      )
    )
  );

export const displaySettings = dropdown({
  icon: typographyIcon,
  title: "display settings",
  children: [displaySettingsPanel({})],
});
