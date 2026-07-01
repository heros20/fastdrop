import JSZip from "jszip";

export const UPLOAD_FILE_COUNT_LIMIT = 20;
export const TRANSFER_SIZE_LIMIT = 2 * 1024 * 1024 * 1024;

const LARGE_SINGLE_FILE_SIZE = 500 * 1024 * 1024;
const MANY_FILES_THRESHOLD = 50;
const MANY_SMALL_FILES_THRESHOLD = 20;
const SMALL_FILE_SIZE = 512 * 1024;
const relativePathByFile = new WeakMap<File, string>();

const INCOMPRESSIBLE_EXTENSIONS = new Set([
  ".zip",
  ".rar",
  ".7z",
  ".tar",
  ".gz",
  ".mp4",
  ".mov",
  ".avi",
  ".mkv",
  ".webm",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".mp3",
  ".aac",
  ".ogg",
  ".flac",
  ".wav",
  ".pdf",
]);

const COMPRESSIBLE_EXTENSIONS = new Set([
  ".txt",
  ".csv",
  ".tsv",
  ".md",
  ".json",
  ".xml",
  ".html",
  ".htm",
  ".css",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".yml",
  ".yaml",
  ".sql",
  ".log",
  ".rtf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".odt",
  ".ods",
  ".odp",
]);

export type TransferFile = File & {
  webkitRelativePath?: string;
};

export type OptimizationReason =
  | "folder"
  | "many-files"
  | "many-small-files"
  | "upload-file-limit"
  | "large-compressible-file"
  | "large-transfer-benefit";

export type TransferOptimizationDecision = {
  shouldOptimize: boolean;
  reason?: OptimizationReason;
  archiveName: string;
};

type FileSystemEntryLike = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
};

type FileSystemFileEntryLike = FileSystemEntryLike & {
  file: (success: (file: File) => void, error?: (error: DOMException) => void) => void;
};

type FileSystemDirectoryReaderLike = {
  readEntries: (
    success: (entries: FileSystemEntryLike[]) => void,
    error?: (error: DOMException) => void,
  ) => void;
};

type FileSystemDirectoryEntryLike = FileSystemEntryLike & {
  createReader: () => FileSystemDirectoryReaderLike;
};

type DataTransferItemWithEntry = DataTransferItem & {
  webkitGetAsEntry?: () => unknown;
};

export function getFileExtension(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : "";
}

export function isIncompressibleFile(file: Pick<File, "name" | "type">) {
  const extension = getFileExtension(file.name);

  if (INCOMPRESSIBLE_EXTENSIONS.has(extension)) return true;

  const type = file.type.toLowerCase();
  return (
    type.startsWith("image/") ||
    type.startsWith("video/") ||
    type.startsWith("audio/") ||
    type === "application/pdf" ||
    type === "application/zip"
  );
}

function isLikelyCompressibleFile(file: Pick<File, "name" | "type">) {
  const extension = getFileExtension(file.name);

  if (isIncompressibleFile(file)) return false;
  if (COMPRESSIBLE_EXTENSIONS.has(extension)) return true;

  const type = file.type.toLowerCase();
  return (
    type.startsWith("text/") ||
    type.includes("json") ||
    type.includes("xml") ||
    type.includes("javascript")
  );
}

function getRelativePath(file: TransferFile) {
  const path = (relativePathByFile.get(file) || file.webkitRelativePath)
    ?.replace(/\\/g, "/")
    .replace(/^\/+/, "");
  return path || file.name;
}

function hasDirectoryStructure(files: TransferFile[]) {
  return files.some((file) => getRelativePath(file).includes("/"));
}

function sanitizeArchiveBaseName(name: string) {
  return (
    name
      .replace(/\.[^.]+$/, "")
      .replace(/[^\w.\-() ]+/g, "-")
      .replace(/-+/g, "-")
      .trim()
      .slice(0, 64) || "fastdrop-transfer"
  );
}

function getArchiveName(files: TransferFile[]) {
  const topLevelNames = new Set(
    files
      .map((file) => getRelativePath(file).split("/")[0])
      .filter(Boolean),
  );

  if (topLevelNames.size === 1 && hasDirectoryStructure(files)) {
    return `${sanitizeArchiveBaseName([...topLevelNames][0])}.zip`;
  }

  return "fastdrop-transfer.zip";
}

export function shouldOptimizeTransfer(
  files: TransferFile[],
): TransferOptimizationDecision {
  const archiveName = getArchiveName(files);

  if (!files.length) {
    return { shouldOptimize: false, archiveName };
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const folderTransfer = hasDirectoryStructure(files);
  const compressibleFiles = files.filter(isLikelyCompressibleFile);
  const incompressibleFiles = files.filter(isIncompressibleFile);
  const compressibleSize = compressibleFiles.reduce((sum, file) => sum + file.size, 0);
  const averageSize = totalSize / files.length;
  const mostlyCompressible =
    files.length > 0 && compressibleFiles.length / files.length >= 0.5;

  if (folderTransfer) {
    return { shouldOptimize: true, reason: "folder", archiveName };
  }

  if (files.length === 1) {
    const file = files[0];

    if (
      file.size > LARGE_SINGLE_FILE_SIZE &&
      isLikelyCompressibleFile(file)
    ) {
      return {
        shouldOptimize: true,
        reason: "large-compressible-file",
        archiveName,
      };
    }

    return { shouldOptimize: false, archiveName };
  }

  if (files.length > MANY_FILES_THRESHOLD) {
    return { shouldOptimize: true, reason: "many-files", archiveName };
  }

  if (files.length > UPLOAD_FILE_COUNT_LIMIT) {
    return { shouldOptimize: true, reason: "upload-file-limit", archiveName };
  }

  if (
    files.length >= MANY_SMALL_FILES_THRESHOLD &&
    averageSize <= SMALL_FILE_SIZE &&
    incompressibleFiles.length !== files.length
  ) {
    return { shouldOptimize: true, reason: "many-small-files", archiveName };
  }

  if (
    totalSize > TRANSFER_SIZE_LIMIT &&
    mostlyCompressible &&
    compressibleSize >= totalSize * 0.5
  ) {
    return {
      shouldOptimize: true,
      reason: "large-transfer-benefit",
      archiveName,
    };
  }

  return { shouldOptimize: false, archiveName };
}

function withRelativePath(file: File, relativePath: string): TransferFile {
  if (!relativePath || relativePath === file.name) return file;

  relativePathByFile.set(file, relativePath);

  try {
    Object.defineProperty(file, "webkitRelativePath", {
      value: relativePath,
      configurable: true,
    });
  } catch {
    return file;
  }

  return file;
}

function readFileEntry(entry: FileSystemFileEntryLike, pathPrefix: string) {
  return new Promise<TransferFile>((resolve, reject) => {
    entry.file(
      (file) => resolve(withRelativePath(file, `${pathPrefix}${file.name}`)),
      reject,
    );
  });
}

function readDirectoryEntries(directory: FileSystemDirectoryEntryLike) {
  const reader = directory.createReader();
  const entries: FileSystemEntryLike[] = [];

  return new Promise<FileSystemEntryLike[]>((resolve, reject) => {
    const readBatch = () => {
      reader.readEntries((batch) => {
        if (!batch.length) {
          resolve(entries);
          return;
        }

        entries.push(...batch);
        readBatch();
      }, reject);
    };

    readBatch();
  });
}

async function readEntry(
  entry: FileSystemEntryLike,
  pathPrefix = "",
): Promise<TransferFile[]> {
  if (entry.isFile) {
    return [await readFileEntry(entry as FileSystemFileEntryLike, pathPrefix)];
  }

  if (!entry.isDirectory) return [];

  const directory = entry as FileSystemDirectoryEntryLike;
  const entries = await readDirectoryEntries(directory);
  const nestedFiles = await Promise.all(
    entries.map((nestedEntry) =>
      readEntry(nestedEntry, `${pathPrefix}${directory.name}/`),
    ),
  );

  return nestedFiles.flat();
}

export async function collectTransferFilesFromDrop(dataTransfer: DataTransfer) {
  const items = Array.from(dataTransfer.items ?? []) as DataTransferItemWithEntry[];
  const entries: FileSystemEntryLike[] = [];

  for (const item of items) {
    const entry = item.webkitGetAsEntry?.() as FileSystemEntryLike | null | undefined;

    if (entry) entries.push(entry);
  }

  if (!entries.length) {
    return Array.from(dataTransfer.files) as TransferFile[];
  }

  const files = await Promise.all(entries.map((entry) => readEntry(entry)));
  return files.flat();
}

export async function createOptimizedArchive(
  files: TransferFile[],
  archiveName: string,
  onProgress?: (progress: number) => void,
) {
  const zip = new JSZip();

  for (const file of files) {
    zip.file(getRelativePath(file), file, {
      compression: isIncompressibleFile(file) ? "STORE" : "DEFLATE",
      compressionOptions: { level: 6 },
      date: new Date(file.lastModified || Date.now()),
    });
  }

  const archive = await zip.generateAsync(
    {
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
      streamFiles: true,
    },
    (metadata) => onProgress?.(Math.round(metadata.percent)),
  );

  return new File([archive], archiveName, {
    type: "application/zip",
    lastModified: Date.now(),
  });
}
