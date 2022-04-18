import type { JsonHtml, UiComponent } from "linki-ui";
import { mountComponent } from "linki-ui";

import type { ComponentMountOptions } from "../../../../linki-ui/src";
import type { EntityViewControls } from "../app/entity-view";

export type ViewBlock<T> = (
  context: T,
  controller: EntityViewControls
) => JsonHtml;

export const mountBlock = (
  component: UiComponent,
  options?: ComponentMountOptions
): JsonHtml => mountComponent<void, void>(component, {}, options)[0];
