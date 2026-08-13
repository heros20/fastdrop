export type MediaKind = "video" | "audio";

export type MediaDescriptor = {
  kind: MediaKind;
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

export function getMediaCandidates(file: SharedMediaFile) {
  const candidates: MediaDescriptor[] = [];
  const storedMimeType = file.mime_type?.split(";", 1)[0].trim().toLowerCase();

  if (storedMimeType?.startsWith("video/")) {
    candidates.push({ kind: "video", mimeType: storedMimeType });
  } else if (storedMimeType?.startsWith("audio/")) {
    candidates.push({ kind: "audio", mimeType: storedMimeType });
  }

  const extensionIndex = file.original_name.lastIndexOf(".");
  const extension =
    extensionIndex >= 0
      ? file.original_name.slice(extensionIndex).toLowerCase()
      : "";
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
