import * as JSZip from "jszip";

export const zipMimeType = "application/zip";

export const createZip = async (
  ...files: [name: string, data: string | object | Blob][]
): Promise<Blob> => {
  const zip = new JSZip.default();
  for (const [name, data] of files) {
    if (typeof data === "object") {
      zip.file(name, JSON.stringify(data));
    } else {
      zip.file(name, data);
    }
  }
  return await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
};

export interface ZipArchive {
  files: string[];
  openJson: (path: string) => Promise<unknown> | undefined;
  openString: (path: string) => Promise<string> | undefined;
  openBlob: (path: string) => Promise<Blob> | undefined;
}

export const openZip = async (zipBlob: Blob): Promise<ZipArchive> => {
  const zip = await JSZip.loadAsync(zipBlob);
  const openString = (path: string) => zip.file(path)?.async("string");
  return {
    files: Object.keys(zip),
    openJson: (path: string) => openString(path)?.then((it) => JSON.parse(it)),
    openString: openString,
    openBlob: (path: string) => zip.file(path)?.async("blob"),
  };
};

export const openJsonZipFiles = async <T>(
  zipBlob: Blob,
  callback: (data: T) => Promise<void>,
  regExp = /.*\.json/
): Promise<void> => {
  const zip = await JSZip.loadAsync(zipBlob);

  for (const file of Object.values(zip.file(regExp))) {
    const linkedData = JSON.parse(await file.async("string")) as T;
    await callback(linkedData);
  }
};
