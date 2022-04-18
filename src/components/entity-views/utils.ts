import type { JsonHtml, UiComponent } from "linki-ui";
import { mountComponent } from "linki-ui";

import type { ComponentMountOptions } from "../../../../linki-ui/src";
import type { LinkedData } from "../../libs/jsonld-format";
import type { EntityViewControls } from "../app/entity-view";

export type EntityView<T extends LinkedData> = (
  context: T,
  controller: EntityViewControls
) => JsonHtml;

export const mountEntityView = (
  component: UiComponent,
  options?: ComponentMountOptions
): JsonHtml => mountComponent<void, void>(component, {}, options)[0];
