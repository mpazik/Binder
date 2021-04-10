import * as pdfjsLib from "pdfjs-dist";

import { defined2 } from "../../libs/connections/filters";
import { branch } from "../../libs/connections/mappers";
import { throwIfUndefined } from "../../libs/errors";
import { createCreativeWork, pdfMediaType } from "../../libs/ld-schemas";
import { LinkedData } from "../../libs/linked-data";
import { measureAsyncTime } from "../../libs/performance";

import type { ContentProcessor } from "./types";
import { getLinkedDataName } from "./utils";

pdfjsLib.GlobalWorkerOptions.workerSrc = "./pdf.worker.js";

export const parsePdfDate = (pdfDate: string): string | undefined => {
  // https://framework.zend.com/manual/1.12/en/zend.pdf.info.html see creation time

  try {
    let i = 0;
    const nextChars = (n: number, opt?: string): string => {
      i += n;
      if (i > pdfDate.length) {
        return throwIfUndefined(opt);
      }
      return pdfDate.substring(i - n, i);
    };
    const checkIfNumber = (s: string): string => {
      if (s === "") return "";
      if (isNaN(parseInt(s))) throw new Error("Can not parse number");
      return s;
    };

    const start = nextChars(2);
    const year = checkIfNumber(
      start === "D:" ? nextChars(4) : start.concat(nextChars(2))
    );
    const month = checkIfNumber(nextChars(2, "01"));
    const date = checkIfNumber(nextChars(2, "01"));
    const hour = checkIfNumber(nextChars(2, ""));
    const minute = checkIfNumber(nextChars(2, ""));
    const second = checkIfNumber(nextChars(2, ""));

    const timezone = (() => {
      const sign = nextChars(1, "");
      if (sign === "" || sign === "Z") return sign;
      if (sign !== "+" && sign !== "-")
        throw new Error("invalid timezone sign");

      const hour = checkIfNumber(nextChars(2, "00"));
      const char1 = nextChars(1, "");
      if (char1 !== "'" && char1 !== "")
        throw new Error("invalid timezone minutes demarcation");
      const minute = checkIfNumber(nextChars(2, ""));
      const char2 = nextChars(1, "");
      if (char2 !== "'" && char2 !== "")
        throw new Error("invalid timezone minutes demarcation");
      return `${sign}${hour}${minute === "" ? "" : ":"}${minute}`;
    })();

    return `${year}-${month}-${date}${hour ? "T" : ""}${hour}${
      minute ? ":" : ""
    }${minute}${second ? ":" : ""}${second}${timezone}`;
  } catch (e) {
    return;
  }
};

// more on https://framework.zend.com/manual/1.12/en/zend.pdf.info.html
type PdfInfoMetadata = {
  PDFFormatVersion?: string;
  IsLinearized?: boolean;
  IsAcroFormPresent?: boolean;
  IsXFAPresent?: boolean;
  IsCollectionPresent?: boolean;
  Author?: string;
  Title?: string;
  Subject?: string;
  Creator?: string;
  Producer?: string;
  Keywords?: string;
  CreationDate?: string;
};

const getPdfType = (numPages: number) => (numPages > 50 ? "Book" : "Article");

export const pdfContentProcessor: ContentProcessor = {
  mediaType: pdfMediaType,
  process: async (content, { url, name, createTime }) => {
    const pdfDocument = await measureAsyncTime("read pdf metadata", () =>
      content.arrayBuffer().then(
        (data) =>
          pdfjsLib.getDocument({
            data: new Uint8Array(data),
          }).promise
      )
    );
    const metadata = await pdfDocument.getMetadata();

    const infoMetadata = metadata.info as PdfInfoMetadata;

    const articleLd: LinkedData = createCreativeWork({
      id: url,
      type: getPdfType(pdfDocument.numPages),
      name: getLinkedDataName(infoMetadata.Title, name),
      encodingFormat: pdfMediaType,
      dateCreated: branch(
        defined2<string>(),
        parsePdfDate,
        () => createTime
      )(infoMetadata.CreationDate),
      urls: url ? [url] : [],
    });

    return {
      content,
      linkedData: articleLd,
    };
  },
};
