export type MediaKind = "video" | "audio";
export type PreviewKind = MediaKind | "image" | "pdf" | "text";

export type MediaDescriptor = {
  kind: MediaKind;
  mimeType: string;
};

export type PreviewDescriptor = {
  kind: PreviewKind;
  mimeType: string;
};

type SharedMediaFile = {
  original_name: string;
  mime_type: string | null;
};

const mediaMimeTypesByExtension: Record<string, MediaDescriptor> = {
  ".mp4": { kind: "video", mimeType: "video/mp4" },
  ".m4v": { kind: "video", mimeType: "video/mp4" },
  ".webm": { kind: "video", mimeType: "video/webm" },
  ".ogv": { kind: "video", mimeType: "video/ogg" },
  ".mov": { kind: "video", mimeType: "video/quicktime" },
  ".mp3": { kind: "audio", mimeType: "audio/mpeg" },
  ".wav": { kind: "audio", mimeType: "audio/wav" },
  ".wave": { kind: "audio", mimeType: "audio/wav" },
  ".m4a": { kind: "audio", mimeType: "audio/mp4" },
  ".aac": { kind: "audio", mimeType: "audio/aac" },
  ".ogg": { kind: "audio", mimeType: "audio/ogg" },
  ".oga": { kind: "audio", mimeType: "audio/ogg" },
  ".opus": { kind: "audio", mimeType: "audio/ogg" },
  ".weba": { kind: "audio", mimeType: "audio/webm" },
  ".flac": { kind: "audio", mimeType: "audio/flac" },
};

const previewTypesByExtension: Record<string, PreviewDescriptor> = {
  ".avif": { kind: "image", mimeType: "image/avif" },
  ".apng": { kind: "image", mimeType: "image/apng" },
  ".bmp": { kind: "image", mimeType: "image/bmp" },
  ".gif": { kind: "image", mimeType: "image/gif" },
  ".ico": { kind: "image", mimeType: "image/x-icon" },
  ".jpeg": { kind: "image", mimeType: "image/jpeg" },
  ".jpg": { kind: "image", mimeType: "image/jpeg" },
  ".png": { kind: "image", mimeType: "image/png" },
  ".svg": { kind: "image", mimeType: "image/svg+xml" },
  ".webp": { kind: "image", mimeType: "image/webp" },
  ".pdf": { kind: "pdf", mimeType: "application/pdf" },
  ".txt": { kind: "text", mimeType: "text/plain" },
  ".md": { kind: "text", mimeType: "text/plain" },
  ".markdown": { kind: "text", mimeType: "text/plain" },
  ".csv": { kind: "text", mimeType: "text/plain" },
  ".json": { kind: "text", mimeType: "text/plain" },
  ".xml": { kind: "text", mimeType: "text/plain" },
  ".html": { kind: "text", mimeType: "text/plain" },
  ".htm": { kind: "text", mimeType: "text/plain" },
  ".css": { kind: "text", mimeType: "text/plain" },
  ".js": { kind: "text", mimeType: "text/plain" },
  ".mjs": { kind: "text", mimeType: "text/plain" },
  ".cjs": { kind: "text", mimeType: "text/plain" },
  ".ts": { kind: "text", mimeType: "text/plain" },
  ".tsx": { kind: "text", mimeType: "text/plain" },
  ".jsx": { kind: "text", mimeType: "text/plain" },
  ".py": { kind: "text", mimeType: "text/plain" },
  ".java": { kind: "text", mimeType: "text/plain" },
  ".c": { kind: "text", mimeType: "text/plain" },
  ".h": { kind: "text", mimeType: "text/plain" },
  ".cpp": { kind: "text", mimeType: "text/plain" },
  ".sql": { kind: "text", mimeType: "text/plain" },
  ".log": { kind: "text", mimeType: "text/plain" },
};
const previewableImageMimeTypes = new Set(
  Object.values(previewTypesByExtension)
    .filter((preview) => preview.kind === "image")
    .map((preview) => preview.mimeType),
);

function getExtension(fileName: string) {
  const extensionIndex = fileName.lastIndexOf(".");

  return extensionIndex >= 0 ? fileName.slice(extensionIndex).toLowerCase() : "";
}

export function getMediaCandidates(file: SharedMediaFile) {
  const candidates: MediaDescriptor[] = [];
  const storedMimeType = file.mime_type?.split(";", 1)[0].trim().toLowerCase();

  if (storedMimeType?.startsWith("video/")) {
    candidates.push({ kind: "video", mimeType: storedMimeType });
  } else if (storedMimeType?.startsWith("audio/")) {
    candidates.push({ kind: "audio", mimeType: storedMimeType });
  }

  const extension = getExtension(file.original_name);
  const extensionCandidate = mediaMimeTypesByExtension[extension];

  if (
    extensionCandidate &&
    !candidates.some(
      (candidate) =>
        candidate.kind === extensionCandidate.kind &&
        candidate.mimeType === extensionCandidate.mimeType,
    )
  ) {
    candidates.push(extensionCandidate);
  }

  return candidates;
}

export function getShareableMedia(file: SharedMediaFile) {
  return getMediaCandidates(file)[0] ?? null;
}

export function getNonMediaPreview(file: SharedMediaFile) {
  const normalizedMimeType = file.mime_type?.split(";", 1)[0].trim().toLowerCase();

  if (normalizedMimeType && previewableImageMimeTypes.has(normalizedMimeType)) {
    return { kind: "image", mimeType: normalizedMimeType } satisfies PreviewDescriptor;
  }

  if (normalizedMimeType === "application/pdf") {
    return { kind: "pdf", mimeType: normalizedMimeType } satisfies PreviewDescriptor;
  }

  if (
    normalizedMimeType?.startsWith("text/") ||
    normalizedMimeType === "application/json" ||
    normalizedMimeType?.endsWith("+json") ||
    normalizedMimeType === "application/xml" ||
    normalizedMimeType?.endsWith("+xml")
  ) {
    return { kind: "text", mimeType: "text/plain" } satisfies PreviewDescriptor;
  }

  return previewTypesByExtension[getExtension(file.original_name)] ?? null;
}
