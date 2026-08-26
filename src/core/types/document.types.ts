export interface Cell {
  id: string;
  content: string;
  title?: string;
}

export interface TextTypstFile {
  path: string;
  isBinary?: false;
  cells: Cell[];
  fileUuid?: string;
}

export interface BinaryTypstFile {
  path: string;
  isBinary: true;
  binaryData: Uint8Array;
  fileUuid?: string;
}

export type TypstFile = TextTypstFile | BinaryTypstFile;

export interface DBTypstFile {
  id: string; // Composite key: "projectId:path"
  fileUuid?: string; // Valid UUID for backend sync
  projectId: string;
  path: string;
  isBinary?: boolean;
  binaryData?: Uint8Array;
  cells?: Cell[];
}
