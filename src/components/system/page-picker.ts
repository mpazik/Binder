import type { View } from "linki-ui";

import { dayType, monthType, weekType, yearType } from "../../libs/calendar-ld";
import type { LinkedData } from "../../libs/jsonld-format";
import { getType } from "../../libs/linked-data";
import { contentComponent } from "../pages/content";
import { docsDirectory } from "../pages/directory";
import { editorPage } from "../pages/editor";
import { errorPage } from "../pages/error";
import { pageFactory } from "../pages/factory";
import {
  annualJournal,
  dailyJournal,
  monthlyJournal,
  weeklyJournal,
} from "../pages/intervals";
import { storePage } from "../pages/store";

import type { PageControls, PageView } from "./page";

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

const findPage = (context: LinkedData): PageView => {
  const dataType = getType(context);
  if (!dataType) return errorPage;
  return pageForType.get(dataType) ?? errorPage;
};

const getPage = (pageData: LinkedData): PageView => {
  const dataType = getType(pageData);
  if (dataType === "SearchResultsPage" || dataType === "NotFoundPage") {
    return docsDirectory;
  } else if (dataType === "Page" && pageData.name === "Docland - Store") {
    return storePage;
  } else if (dataType === "Page" && pageData.name === "Docland - Editor") {
    return editorPage;
  } else if (dataType === "AboutPage" || dataType === "Page") {
    return pageFactory(pageData);
  } else {
    return pageFactory(pageData);
  }
};

export const createPageView = ({
  controls,
}: {
  controls: PageControls;
}): View<LinkedData> => (data) => {
  if (isPage(data)) {
    const context = getContextParam();
    const page = getPage(data);
    return page(controls, context);
  } else {
    const context = data;
    const page = findPage(context);
    return page(controls, context);
  }
};
