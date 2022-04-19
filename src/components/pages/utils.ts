import type { JsonHtml, UiComponent } from "linki-ui";
import { mountComponent } from "linki-ui";

import type { ComponentMountOptions } from "../../../../linki-ui/src";
import type { LinkedData } from "../../libs/jsonld-format";
import type { PageControls } from "../app/entity-view";

export type PageView<T extends LinkedData> = (
  controller: PageControls,
  context: T
) => JsonHtml;

export const mountPage = (
  component: UiComponent,
  options?: ComponentMountOptions
): JsonHtml => mountComponent<void, void>(component, {}, options)[0];
