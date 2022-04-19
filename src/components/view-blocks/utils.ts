import type { JsonHtml, UiComponent } from "linki-ui";
import { mountComponent } from "linki-ui";

import type { ComponentMountOptions } from "../../../../linki-ui/src";
import type { PageControls } from "../app/entity-view";

export type PageBlock<T> = (controller: PageControls, context: T) => JsonHtml;

export const mountBlock = (
  component: UiComponent,
  options?: ComponentMountOptions
): JsonHtml => mountComponent<void, void>(component, {}, options)[0];
