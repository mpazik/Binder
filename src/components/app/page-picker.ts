import type { UiComponent } from "linki-ui";
import { dangerousHtml, div, pre } from "linki-ui";

import { dayType, monthType, weekType, yearType } from "../../libs/calendar-ld";
import type { LinkedData } from "../../libs/jsonld-format";
import { getType } from "../../libs/linked-data";
import { contentComponent } from "../content";
import { docsDirectory } from "../directory";
import { editorPage } from "../editor";
import {
  annualJournal,
  dailyJournal,
  monthlyJournal,
  weeklyJournal,
} from "../pages/intervals";
import type { PageView } from "../pages/utils";
import { storePage } from "../store";

import type { PageControls } from "./entity-view";

const pageForType = new Map<string, PageView>([
  [dayType, dailyJournal],
  [weekType, weeklyJournal],
  [monthType, monthlyJournal],
  [yearType, annualJournal],
  ["Article", contentComponent],
  ["Book", contentComponent],
]);

const getContextParam = () => {
  // to be implemented later
  return undefined;
};

const pagesTypes = ["Page", "SearchResultsPage", "NotFoundPage", "AboutPage"];
const isPage = (data: LinkedData): boolean => {
  const type = getType(data);
  return type !== undefined && pagesTypes.includes(type);
};

const errorPage: PageView = (controller, context) =>
  div({}, "Error", pre(JSON.stringify(context)));

const findPage = (context: LinkedData): PageView => {
  const dataType = getType(context);
  if (!dataType) return errorPage;
  return pageForType.get(dataType) ?? errorPage;
};

const staticPage: PageView = (controller, linkedData) => {
  if (
    !linkedData ||
    !linkedData.articleBody ||
    typeof linkedData.articleBody !== "string"
  )
    return errorPage(controller, linkedData);
  return dangerousHtml(linkedData.articleBody);
};

const getPage = (linkedData: LinkedData): PageView => {
  const dataType = getType(linkedData);
  if (dataType === "SearchResultsPage" || dataType === "NotFoundPage") {
    return docsDirectory;
  } else if (dataType === "Page" && linkedData.name === "Docland - Store") {
    return storePage;
  } else if (dataType === "Page" && linkedData.name === "Docland - Editor") {
    return editorPage;
  } else if (dataType === "AboutPage" || dataType === "Page") {
    return staticPage;
  } else {
    return errorPage;
  }
};

export const createPageRender = ({
  controls,
}: {
  controls: PageControls;
}): UiComponent<{ displayData: LinkedData }> => ({ render }) => {
  const renderPage = (
    controls: PageControls,
    page: PageView,
    context?: LinkedData
  ) => {
    return render(page(controls, context));
  };

  return {
    displayData: (data) => {
      if (isPage(data)) {
        const context = getContextParam();
        const page = getPage(data);
        renderPage(controls, page, context);
      } else {
        const context = data;
        const page = findPage(context);
        renderPage(controls, page, context);
      }
    },
  };
};
