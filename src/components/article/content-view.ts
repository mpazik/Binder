import { URL } from "schema-dts";

import {
  getDocumentContentRoot,
  LinkedDataWithDocument,
} from "../../functions/article-processor";
import { DocumentAnnotationsIndex } from "../../functions/indexes/document-annotations-index";
import {
  LinkedDataStoreWrite,
  ResourceStoreWrite,
} from "../../functions/store";
import { LinkedDataStoreRead } from "../../functions/store/local-store";
import { Consumer, dataPortal, fork, Provider } from "../../libs/connections";
import { map, merge } from "../../libs/connections/processors2";
import { throwIfNull } from "../../libs/errors";
import { HashUri } from "../../libs/hash";
import {
  findHashUri,
  findUrl,
  LinkedData,
  LinkedDataWithHashId,
} from "../../libs/linked-data";
import {
  a,
  article,
  Component,
  div,
  slot,
  span,
  View,
} from "../../libs/simple-ui/render";
import { throttleArg } from "../../libs/throttle";
import { annotationsSupport } from "../annotations";
import { currentSelection, OptSelection } from "../annotations/selection";
import {
  articleEditSupport,
  EditorContext,
  EditorContextWithHash,
  isEditable,
} from "../article-edit";
import {
  DocumentChange,
  newDocumentComparator,
} from "../article-edit/document-change";

const detectDocumentChange = (
  contentRoot: HTMLElement,
  onChange: (c: DocumentChange[]) => void
) => (e: InputEvent) =>
  throttleArg<Element>(
    map(newDocumentComparator(contentRoot), onChange),
    300
  )(e.target as HTMLElement);

const contentHeaderView: View<LinkedData> = (linkedData: LinkedData) => {
  const uri = findUrl(linkedData);
  return div(
    { class: "Subhead" },
    div({ class: "Subhead-heading" }, String(linkedData.name)),
    div(
      { class: "Subhead-description" },
      ...(uri
        ? [
            span(
              "From: ",
              a({ href: uri, target: "_blank" }, new URL(uri).hostname)
            ),
          ]
        : [])
    )
  );
};

export const contentDisplayComponent: Component<{
  provider: Provider<{ content: Document; editable: boolean }>;
  onDisplay: Consumer<HTMLElement>;
  onChange: Consumer<DocumentChange[]>;
  onSelect: Consumer<OptSelection>;
}> = ({ provider, onDisplay, onChange, onSelect }) => (render, onClose) => {
  provider(onClose, ({ content, editable }) => {
    const contentRoot = getDocumentContentRoot(content);
    let editorElement: HTMLElement | undefined;
    render(
      article({
        id: "editor-body",
        contenteditable: editable,
        class: "editable markdown-body flex-1",
        style: { outline: "none" },
        onInput: onChange
          ? detectDocumentChange(contentRoot, onChange) // ideally should be triggered on resize too
          : undefined,
        dangerouslySetInnerHTML: contentRoot?.innerHTML,
        onMouseup: () => {
          if (editorElement) onSelect(currentSelection(editorElement));
        },
        onFocusout: () => {
          console.log("focus out");
          onSelect(undefined);
        },
        onDisplay: (e) => {
          editorElement = e.target as HTMLElement;
          if (onDisplay) {
            onDisplay(editorElement);
          }
        },
      })
    );
  });
};

export const editableContentComponent: Component<{
  provider: Provider<LinkedDataWithDocument>;
  storeWrite: ResourceStoreWrite;
  ldStoreWrite: LinkedDataStoreWrite;
  ldStoreRead: LinkedDataStoreRead;
  onSave: Consumer<LinkedDataWithHashId>;
  documentAnnotationsIndex: DocumentAnnotationsIndex;
  creatorProvider: Provider<string>;
}> = ({
  provider,
  storeWrite,
  ldStoreWrite,
  ldStoreRead,
  onSave,
  documentAnnotationsIndex,
  creatorProvider,
}) => (render, onClose) => {
  const [documentProvider, displayAnnotations] = dataPortal<{
    container: HTMLElement;
    linkedData: LinkedData;
  }>();
  const [editorContextProvider, setContext] = dataPortal<EditorContext>();
  const [referenceProvider, setReference] = dataPortal<HashUri>();
  const [saveRequestProvider, requestDocumentSave] = dataPortal<void>();
  const [setDisplay, setContent] = merge<HTMLElement, LinkedDataWithDocument>(
    fork(
      ([container, { linkedData }]) => {
        displayAnnotations({ container, linkedData });
      },
      ([container, documentContent]) => {
        setContext({ container, ...documentContent });
      }
    )
  );

  const [changesProvider, onChange] = dataPortal<
    DocumentChange[] | undefined
  >();

  const [fieldsProvider, linkedDataForFields] = dataPortal<LinkedData>();
  const [selectionProvider, onSelect] = dataPortal<OptSelection>();

  const [contentProvider, documentToDisplay] = dataPortal<{
    content: Document;
    editable: boolean;
  }>();

  provider(
    onClose,
    fork(
      map(({ linkedData }) => linkedData, linkedDataForFields),
      map(
        ({ contentDocument, linkedData }) => ({
          content: contentDocument,
          editable: isEditable(linkedData),
        }),
        documentToDisplay
      ),
      ({ linkedData }) => onChange(isEditable(linkedData) ? [] : undefined), // reset change bar
      setContent,
      ({ linkedData }) => {
        const hashUri = findHashUri(linkedData);
        if (hashUri) setReference(hashUri);
      }
    )
  );

  render(
    div(
      { id: "content", class: "ml-4" },
      slot("content-fields", (render) => {
        fieldsProvider(onClose, (linkedData) =>
          render(contentHeaderView(linkedData))
        );
      }),
      div(
        { id: "editor", class: "mb-3 position-relative" },
        slot(
          "content",
          contentDisplayComponent({
            provider: contentProvider,
            onChange,
            onDisplay: setDisplay,
            onSelect,
          })
        ),
        slot(
          "edit-support",
          articleEditSupport({
            changesProvider,
            ldStoreWrite,
            storeWrite,
            onSave: fork<EditorContextWithHash>(
              setContext,
              ({ linkedData }) => onSave(linkedData),
              ({ linkedData }) => {
                const hashUri = throwIfNull(
                  findHashUri(linkedData),
                  () =>
                    "save article should have hash uri reference to the content"
                );
                setReference(hashUri);
              }
            ),
            editorContextProvider,
            saveRequestProvider,
          })
        ),
        slot(
          "annotation-support",
          annotationsSupport({
            selectionProvider,
            creatorProvider,
            ldStoreWrite,
            ldStoreRead,
            documentProvider,
            referenceProvider,
            documentAnnotationsIndex,
            requestDocumentSave,
          })
        )
      )
    )
  );
};
