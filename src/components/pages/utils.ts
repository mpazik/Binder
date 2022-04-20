import type { JsonHtml, UiComponent } from "linki-ui";
import { mountComponent } from "linki-ui";

import type { ComponentMountOptions } from "../../../../linki-ui/src";
import type { LinkedData } from "../../libs/jsonld-format";
import type { PageControls } from "../app/entity-view";

// todo - find out a solution for optional context
// either page could declare what kind of context it supports or I would need to support any context and throw and error if item is not expected
// if there is no item it could display select box or be a form for a new linked data
// Personally I would prefer for page to be able to declare what it needs and handle problems globally
export type PageView = (
  controller: PageControls,
  context?: LinkedData
) => JsonHtml;

export const mountPage = (
  component: UiComponent,
  options?: ComponentMountOptions
): JsonHtml => mountComponent<void, void>(component, {}, options)[0];
