import {
  documentContentRoodId,
  getDocumentContentRoot,
} from "../../functions/article-processor";
import { dataPortal, join, map, Provider } from "../../libs/connections";
import { newStateMapper } from "../../libs/named-state";
import {
  button,
  Component,
  div,
  JsonHtml,
  OptionalViewSetup,
  span,
} from "../../libs/simple-ui/render";

import { revertDocument } from "./document-change";

export type EditBarState =
  | ["hidden"]
  | ["visible", { editor: Element }]
  | ["publishing"];

const createNewDocument = (
  initialContent: Document,
  editor: Element
): Document => {
  const newDocument = document.implementation.createHTMLDocument(
    initialContent.title
  );
  newDocument.head.innerHTML = initialContent.head.innerHTML;
  const newContentRoot = newDocument.createElement("div");
  newContentRoot.id = documentContentRoodId;
  newContentRoot.innerHTML = editor.innerHTML;
  newDocument.body.appendChild(newContentRoot);
  return newDocument;
};

function bar(...controls: JsonHtml[]) {
  return div(
    {
      class:
        "position-sticky Box p-3 bottom-0 box-shadow-medium anim-fade-up d-flex flex-row-reverse bg-gray",
      style: { "animation-delay": "0s" },
    },
    ...controls,
    span({ class: "flex-1 f4" }, "Document has been modified")
  );
}

const editBarView: OptionalViewSetup<
  { initialContent: Document; onPublish: (d: Document) => void },
  EditBarState
> = ({ initialContent, onPublish }) =>
  newStateMapper({
    hidden: () => undefined,
    visible: ({ editor }) =>
      bar(
        button(
          {
            class: "btn btn-primary mr-2",
            type: "button",
            onClick: () => {
              onPublish(createNewDocument(initialContent, editor));
            },
          },
          "Publish"
        ),
        button(
          {
            class: "btn btn-danger mr-2",
            type: "button",
            onClick: () => {
              revertDocument(getDocumentContentRoot(initialContent), editor);
            },
          },
          "Discard"
        )
      ),
    publishing: () =>
      bar(
        button(
          {
            class: "btn btn-primary mr-2",
            type: "button",
          },
          "saving"
        )
      ),
  });

export const editBar: Component<{
  initialContent: Document;
  provider: Provider<EditBarState>;
  onPublish: (document: Document) => void;
}> = ({ provider, onPublish, initialContent }) => (render) => {
  const [editStateProvider, editStateConsumer] = dataPortal<EditBarState>();
  join(
    provider,
    editStateProvider
  )(
    map(
      editBarView({
        initialContent,
        onPublish: (newDocument) => {
          onPublish(newDocument);
          editStateConsumer(["publishing"]);
        },
      })
    )(render)
  );
};
