export type FileSystemEntry = {
  name: string;
  path: string;
  type: "file" | "directory";
  size: number;
  modifiedAt: number;
};

export type DirectoryListing = {
  path: string;
  entries: FileSystemEntry[];
  warning?: string;
};

export type FileContentPayload = {
  path: string;
  name: string;
  size: number;
  modifiedAt: number;
  content?: string;
  encoding: "utf-8" | "binary";
  editable: boolean;
  reason?: string;
};
