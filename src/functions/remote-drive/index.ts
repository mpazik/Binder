export interface RemoteDrive<FileId> {
  downloadLinkedDataFile: (fileId: FileId) => Promise<Response>;
  listFilesCreatedSince: (date: Date | undefined) => Promise<FileId[]>;
}
