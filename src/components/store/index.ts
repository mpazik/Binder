import type { Callback, ProcessorMultiOut } from "linki";
import {
  asyncMap,
  fork,
  kick,
  link,
  map,
  onSecondOutput,
  split,
  to,
  tryMap,
  withErrorLogging,
} from "linki";
import type { JsonHtml, UiComponent, View } from "linki-ui";
import {
  button,
  code,
  createRenderer,
  details,
  div,
  dom,
  h2,
  h3,
  label,
  li,
  mountComponent,
  pre,
  renderJsonHtmlToDom,
  span,
  summary,
  textarea,
  ul,
} from "linki-ui";

import type {
  LinkedDataStoreReadAll,
  LinkedDataStoreWrite,
} from "../../functions/store/local-store";
import type { HashName } from "../../libs/hash";
import type {
  LinkedData,
  LinkedDataWithHashId,
} from "../../libs/jsonld-format";
import {
  getHash,
  isLinkedData,
  validateLinkedData,
} from "../../libs/linked-data";
import type { PageControls } from "../app/entity-view";

const listData = (
  realAllLinkedData: LinkedDataStoreReadAll
): UiComponent<{ refresh: void }> => ({ render }) => {
  const refresh: Callback = link(
    kick<void>(undefined),
    withErrorLogging(asyncMap(realAllLinkedData)),
    map((list) =>
      div(
        h3("Record list", span({ class: "f4 Counter m-1" }, list.length + "")),
        ...list.map((it) =>
          details(summary(code(it["@id"])), pre(JSON.stringify(it, null, 4)))
        )
      )
    ),
    render
  );
  return {
    refresh: () => {
      refresh();
    },
  };
};

const successFlash: View<JsonHtml> = (message) =>
  div({ class: "flash" }, message);

const successfullyAddedFlash: View<HashName> = (hash: HashName) =>
  successFlash([span("Successfully added "), code(hash)]);

const errorFlash: View<JsonHtml> = (message) =>
  div({ class: "flash flash-error" }, message);

const linkedDataValidator: ProcessorMultiOut<
  LinkedData,
  [LinkedData, string[]]
> = ([pushData, pushError]) => (value) => {
  validateLinkedData(value)
    .then((errors) => {
      if (errors.length > 0) {
        pushError(errors);
      } else {
        pushData(value);
      }
    })
    .catch((error) => pushError([error.toString()]));
};

const add: View<{
  saveLinkedDataManually: LinkedDataStoreWrite;
  onSuccessfullyAdded: Callback<LinkedDataWithHashId>;
}> = ({ saveLinkedDataManually, onSuccessfullyAdded }) => {
  const inputElement = renderJsonHtmlToDom(
    textarea({ class: "form-control" })
  ) as HTMLTextAreaElement;
  const messageSlot = document.createElement("div");
  const renderMessage = createRenderer(messageSlot);
  const renderError = (message: JsonHtml) =>
    link(map(to(message), errorFlash), renderMessage);

  const renderInfo = link(map(getHash, successfullyAddedFlash), renderMessage);

  return div(
    { class: "form-group" },
    div({ class: "form-group-header" }, label("Add new record")),
    div({ class: "form-group-body" }, dom(inputElement)),
    div({ class: "mt-2" }, dom(messageSlot)),
    div(
      { class: "form-actions mt-2" },
      button(
        {
          class: "btn",
          onClick: link(
            map(() => inputElement.value),
            onSecondOutput(
              tryMap(JSON.parse),
              renderError("Text is not in valid JSON format.")
            ),
            onSecondOutput(
              split(isLinkedData),
              renderError("Text is not in valid JSONLD format.")
            ),
            link(
              onSecondOutput(linkedDataValidator, (errors) => {
                renderError([
                  span("Json data is not valid. Reasons:"),
                  pre(
                    ul(
                      { class: "list-style-none" },
                      ...errors.map((it) => li(it))
                    )
                  ),
                ])(undefined);
              }),
              onSecondOutput(
                asyncMap(saveLinkedDataManually),
                fork(
                  console.error,
                  renderError(
                    "For unknown reason failed saving data to storage."
                  )
                )
              ),
              fork(renderInfo, onSuccessfullyAdded)
            )
          ),
        },
        "Add"
      )
    )
  );
};

export const storePage: View<PageControls> = ({
  saveLinkedDataManually,
  readAllLinkedData,
}) => {
  const [slot, { refresh }] = mountComponent(listData(readAllLinkedData));
  const slotAdd = add({
    saveLinkedDataManually,
    onSuccessfullyAdded: () => refresh(),
  });

  return div(
    { class: "with-line-length-settings my-10" },
    h2("Linked data"),
    slotAdd,
    slot
  );
};
