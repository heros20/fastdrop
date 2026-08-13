"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  getMediaCandidates,
  getNonMediaPreview,
  type PreviewKind,
} from "@/lib/shared-media";

const API = process.env.NEXT_PUBLIC_API_URL!;

type TransferFile = {
  id: string;
  original_name: string;
  size: number;
  mime_type: string | null;
};

type Transfer = {
  slug: string;
  title: string | null;
  senderName: string | null;
  message: string | null;
  protected: boolean;
  expiresAt: string;
  files: TransferFile[];
};

type FilePreview = {
  file: TransferFile;
  kind: PreviewKind;
  mimeType: string;
};

function getPlayableMedia(file: TransferFile): FilePreview | null {
  for (const candidate of getMediaCandidates(file)) {
    const mediaElement = document.createElement(candidate.kind);

    if (mediaElement.canPlayType(candidate.mimeType)) {
      return { file, ...candidate };
    }
  }

  return null;
}

function getFilePreview(file: TransferFile): FilePreview | null {
  const playableMedia = getPlayableMedia(file);

  if (playableMedia) return playableMedia;

  const preview = getNonMediaPreview(file);

  return preview ? { file, ...preview } : null;
}

function getPreviewActionLabel(kind: PreviewKind) {
  if (kind === "video") return "Regarder";
  if (kind === "audio") return "Écouter";
  return "Voir";
}

function formatSize(size: number) {
  if (size < 1024) return `${size} o`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} Ko`;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} Mo`;
  return `${(size / 1024 / 1024 / 1024).toFixed(2)} Go`;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(date));
}

function getFileTypeLabel(file: TransferFile) {
  const mimeType = file.mime_type?.toLowerCase() ?? "";
  const name = file.original_name.toLowerCase();

  if (mimeType.startsWith("image/")) return "IMG";
  if (mimeType.startsWith("video/")) return "VID";
  if (mimeType.startsWith("audio/")) return "AUD";
  if (name.endsWith(".zip") || name.endsWith(".rar") || name.endsWith(".7z")) {
    return "ZIP";
  }
  if (name.endsWith(".pdf")) return "PDF";
  if (name.endsWith(".doc") || name.endsWith(".docx")) return "DOC";
  if (name.endsWith(".xls") || name.endsWith(".xlsx") || name.endsWith(".csv")) {
    return "XLS";
  }

  return "FILE";
}

function DownloadShell({
  children,
  compact = false,
}: {
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <main className="fastdrop-bg relative min-h-screen overflow-hidden px-6 py-8 text-white">
      <div className="noise pointer-events-none absolute inset-0 opacity-30" />
      <div className="glow-pulse pointer-events-none absolute left-1/2 top-20 h-80 w-80 -translate-x-1/2 rounded-full bg-blue-500/30 blur-[120px]" />
      <div className="pointer-events-none absolute right-[-10%] top-32 h-96 w-96 rounded-full bg-violet-600/20 blur-[140px]" />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between">
        <Link href="/" className="flex items-center gap-4" aria-label="Accueil FastDrop">
          <span className="relative block">
            <span className="absolute inset-0 scale-150 rounded-full bg-blue-500/40 blur-xl" />
            <Image
              src="/fd-logo.png"
              alt="FastDrop"
              width={52}
              height={52}
              priority
              className="relative transition-transform duration-300 hover:scale-105 drop-shadow-[0_0_28px_rgba(59,130,246,.45)]"
            />
          </span>

          <span>
            <span className="block text-2xl font-black tracking-tight">
              Fast
              <span className="bg-gradient-to-r from-sky-400 via-blue-400 to-violet-500 bg-clip-text text-transparent">
                Drop
              </span>
            </span>
            <span className="block text-xs uppercase tracking-[0.30em] text-white/35">
              Personal Cloud
            </span>
          </span>
        </Link>

        <Link
          href="/"
          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/60 transition hover:border-blue-300/40 hover:bg-white/10 hover:text-white"
        >
          Nouveau transfert
        </Link>
      </header>

      <section
        className={[
          "relative z-10 mx-auto flex max-w-5xl flex-col items-center",
          compact ? "min-h-[70vh] justify-center" : "pt-14",
        ].join(" ")}
      >
        {children}
      </section>
    </main>
  );
}

export default function DownloadPageClient() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const deleteToken = searchParams.get("delete_token");

  const [transfer, setTransfer] = useState<Transfer | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);
  const [activePreview, setActivePreview] = useState<FilePreview | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState("");

  useEffect(() => {
    async function loadTransfer() {
      try {
        const response = await fetch(`${API}/transfers/${params.slug}`);

        if (!response.ok) {
          throw new Error("Transfert introuvable ou expiré.");
        }

        const data = (await response.json()) as Transfer;

        setTransfer(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue.");
      }
    }

    loadTransfer();
  }, [params.slug]);

  useEffect(() => {
    if (!activePreview) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActivePreview(null);
        setPreviewUrl(null);
        setPreviewError("");
      }
    }

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [activePreview]);

  function closePreview() {
    setActivePreview(null);
    setPreviewUrl(null);
    setPreviewError("");
  }

  async function openPreview(preview: FilePreview) {
    setActivePreview(preview);
    setPreviewUrl(null);
    setPreviewingId(preview.file.id);
    setPreviewError("");

    try {
      const response = await fetch(`${API}/preview-access/${preview.file.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password: password.trim() || undefined,
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        url?: string;
        mimeType?: string;
        error?: string;
      } | null;

      if (!response.ok || !data?.url) {
        throw new Error(
          data?.error ??
            "Prévisualisation impossible. Vérifie le mot de passe si nécessaire.",
        );
      }

      setActivePreview((currentPreview) =>
        currentPreview?.file.id === preview.file.id
          ? {
              ...currentPreview,
              mimeType: data.mimeType ?? currentPreview.mimeType,
            }
          : currentPreview,
      );
      setPreviewUrl(data.url);
    } catch (err) {
      setPreviewError(
        err instanceof Error
          ? err.message
          : "Prévisualisation impossible pour le moment.",
      );
    } finally {
      setPreviewingId(null);
    }
  }

  async function downloadFile(file: TransferFile) {
    setDownloadingId(file.id);

    try {
      const response = await fetch(`${API}/download/${file.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password: password.trim() || undefined,
        }),
      });

      if (!response.ok) {
        alert("Téléchargement impossible. Vérifie le mot de passe si nécessaire.");
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = file.original_name;
      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(url);
    } finally {
      setDownloadingId(null);
    }
  }

  async function downloadAllFiles() {
    if (!transfer) return;

    setIsDownloadingAll(true);

    try {
      const response = await fetch(`${API}/download-transfer/${transfer.slug}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password: password.trim() || undefined,
        }),
      });

      if (!response.ok) {
        alert("Téléchargement impossible. Vérifie le mot de passe si nécessaire.");
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `${transfer.title || `fastdrop-${transfer.slug}`}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(url);
    } finally {
      setIsDownloadingAll(false);
    }
  }

  async function deleteTransfer() {
    if (!transfer || !deleteToken) return;
    if (!confirm("Supprimer définitivement ce transfert ?")) return;

    setIsDeleting(true);

    try {
      const response = await fetch(
        `${API}/transfers/${transfer.slug}?delete_token=${encodeURIComponent(deleteToken)}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        alert("Suppression impossible.");
        return;
      }

      setTransfer(null);
      setIsDeleted(true);
    } finally {
      setIsDeleting(false);
    }
  }

  if (isDeleted) {
    return (
      <DownloadShell compact>
        <div className="gradient-border w-full max-w-xl rounded-[2rem] p-[1px]">
          <div className="rounded-[2rem] bg-[#070b18]/90 p-8 text-center backdrop-blur-xl">
            <Image
              src="/fd-logo.png"
              alt=""
              width={86}
              height={86}
              className="logo-float mx-auto mb-6"
            />
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.30em] text-emerald-200/70">
              Transfert supprimé
            </p>
            <h1 className="text-3xl font-black tracking-tight">
              Le lien n&apos;est plus accessible
            </h1>
            <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-white/55">
              Les fichiers et le lien de partage ont bien été supprimés.
            </p>
            <Link
              href="/"
              className="mt-7 inline-flex rounded-2xl bg-white px-6 py-3 font-bold text-black transition hover:bg-blue-100"
            >
              Retour à l&apos;accueil
            </Link>
          </div>
        </div>
      </DownloadShell>
    );
  }

  if (error) {
    return (
      <DownloadShell compact>
        <div className="gradient-border w-full max-w-xl rounded-[2rem] p-[1px]">
          <div className="rounded-[2rem] bg-[#070b18]/90 p-8 text-center backdrop-blur-xl">
            <Image
              src="/fd-logo.png"
              alt=""
              width={86}
              height={86}
              className="logo-float mx-auto mb-6"
            />
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.30em] text-red-200/70">
              Lien indisponible
            </p>
            <h1 className="text-3xl font-black tracking-tight">Ce transfert n&apos;est plus accessible</h1>
            <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-white/55">{error}</p>
            <Link
              href="/"
              className="mt-7 inline-flex rounded-2xl bg-white px-6 py-3 font-bold text-black transition hover:bg-blue-100"
            >
              Créer un nouveau transfert
            </Link>
          </div>
        </div>
      </DownloadShell>
    );
  }

  if (!transfer) {
    return (
      <DownloadShell compact>
        <div className="text-center">
          <Image
            src="/fd-logo.png"
            alt=""
            width={84}
            height={84}
            className="logo-float mx-auto mb-5"
          />
          <p className="text-sm uppercase tracking-[0.30em] text-white/45">Chargement</p>
        </div>
      </DownloadShell>
    );
  }

  const totalSize = transfer.files.reduce((sum, file) => sum + file.size, 0);
  const fileCount = transfer.files.length;

  return (
    <DownloadShell>
      <div className="mb-8 w-full text-center">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-white/70 shadow-2xl backdrop-blur">
          <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.9)]" />
          Transfert prêt
        </div>

        <h1 className="mx-auto max-w-3xl text-4xl font-black tracking-tight md:text-6xl">
          {transfer.title || "Fichiers disponibles"}
        </h1>

        {transfer.senderName && (
          <p className="mt-3 text-sm font-semibold uppercase tracking-[0.24em] text-blue-200/70">
            Envoyé par {transfer.senderName}
          </p>
        )}

        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-300">
          Ces fichiers sont disponibles jusqu&apos;au {formatDate(transfer.expiresAt)}.
        </p>
      </div>

      <div className="gradient-border w-full rounded-[2rem] p-[1px] shadow-[0_0_80px_rgba(37,99,235,0.16)]">
        <div className="rounded-[2rem] bg-[#070b18]/90 p-5 backdrop-blur-xl md:p-7">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-white/35">Expiration</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-white">
                {formatDate(transfer.expiresAt)}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-white/35">Taille totale</p>
              <p className="mt-2 text-2xl font-black text-blue-200">{formatSize(totalSize)}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-white/35">Nombre de fichiers</p>
              <p className="mt-2 text-2xl font-black text-violet-200">{fileCount}</p>
            </div>
          </div>

          {transfer.message && (
            <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-white/35">
                Message
              </p>
              <p className="whitespace-pre-wrap text-sm leading-7 text-slate-200">
                {transfer.message}
              </p>
            </div>
          )}

          {transfer.protected && (
            <label className="mt-5 block rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <span className="mb-3 block text-sm font-semibold text-white/80">
                Mot de passe du transfert
              </span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                placeholder="Entre le mot de passe"
                className="w-full rounded-2xl border border-white/10 bg-[#080d1b] px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-violet-400 focus:shadow-[0_0_30px_rgba(139,92,246,0.25)]"
              />
            </label>
          )}

          <div className="mt-5 flex flex-col gap-3 rounded-3xl border border-emerald-300/15 bg-emerald-300/10 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-emerald-100">Tout récupérer en une fois</p>
              <p className="mt-1 text-sm text-white/50">
                Télécharge les {fileCount} fichiers dans une archive ZIP.
              </p>
            </div>

            <button
              type="button"
              onClick={downloadAllFiles}
              disabled={isDownloadingAll}
              className="shrink-0 rounded-2xl bg-emerald-300 px-5 py-3 text-sm font-bold text-black transition hover:bg-emerald-200 disabled:cursor-wait disabled:opacity-60"
            >
              {isDownloadingAll ? "Préparation..." : "Tout télécharger"}
            </button>
          </div>

          {deleteToken && (
            <div className="mt-5 flex flex-col gap-3 rounded-3xl border border-red-300/15 bg-red-500/10 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-red-100">Gestion du transfert</p>
                <p className="mt-1 text-sm text-white/50">
                  Ce lien privé permet de supprimer définitivement les fichiers.
                </p>
              </div>

              <button
                type="button"
                onClick={deleteTransfer}
                disabled={isDeleting}
                className="shrink-0 rounded-2xl border border-red-200/30 bg-red-500/20 px-5 py-3 text-sm font-bold text-red-50 transition hover:bg-red-500/30 disabled:cursor-wait disabled:opacity-60"
              >
                {isDeleting ? "Suppression..." : "Supprimer le transfert"}
              </button>
            </div>
          )}

          <div className="mt-5 space-y-3">
            {transfer.files.map((file) => {
              const preview = getFilePreview(file);

              return (
                <div
                  key={file.id}
                  className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/25 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-xs font-black text-blue-100">
                      {getFileTypeLabel(file)}
                    </span>

                    <div className="min-w-0">
                      <p className="truncate font-semibold">{file.original_name}</p>
                      <p className="mt-1 text-sm text-white/45">{formatSize(file.size)}</p>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    {preview && (
                      <button
                        type="button"
                        onClick={() => openPreview(preview)}
                        disabled={previewingId !== null}
                        aria-label={`${getPreviewActionLabel(preview.kind)} ${file.original_name}`}
                        className="rounded-2xl border border-blue-200/25 bg-blue-400/15 px-5 py-3 text-sm font-bold text-blue-50 transition hover:border-blue-200/45 hover:bg-blue-400/25 disabled:cursor-wait disabled:opacity-60"
                      >
                        {previewingId === file.id
                          ? "Ouverture..."
                          : getPreviewActionLabel(preview.kind)}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => downloadFile(file)}
                      disabled={downloadingId === file.id}
                      className="rounded-2xl bg-white px-5 py-3 text-sm font-bold text-black transition hover:bg-blue-100 disabled:cursor-wait disabled:opacity-60"
                    >
                      {downloadingId === file.id ? "Préparation..." : "Télécharger"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex justify-center">
            <Link
              href="/"
              className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 font-semibold text-white/70 transition hover:border-blue-300/40 hover:bg-white/10 hover:text-white"
            >
              Créer un nouveau transfert
            </Link>
          </div>
        </div>
      </div>

      {activePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
          <button
            type="button"
            aria-label="Fermer l’aperçu"
            onClick={closePreview}
            className="absolute inset-0 cursor-default bg-[#02040c]/90 backdrop-blur-md"
          />

          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="file-preview-title"
            className="relative z-10 flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-white/15 bg-[#080d1b] shadow-[0_0_100px_rgba(37,99,235,0.25)]"
          >
            <header className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-200/55">
                  {activePreview.kind === "video"
                    ? "Vidéo"
                    : activePreview.kind === "audio"
                      ? "Audio"
                      : activePreview.kind === "image"
                        ? "Image"
                        : activePreview.kind === "pdf"
                          ? "Document PDF"
                          : "Fichier texte"}
                </p>
                <h2
                  id="file-preview-title"
                  className="mt-1 truncate text-base font-bold text-white sm:text-lg"
                >
                  {activePreview.file.original_name}
                </h2>
              </div>

              <button
                type="button"
                onClick={closePreview}
                autoFocus
                className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                Fermer
              </button>
            </header>

            <div className="min-h-48 overflow-auto bg-black/35">
              {!previewUrl && !previewError && (
                <div className="flex min-h-64 items-center justify-center p-8 text-sm text-white/55">
                  Préparation de l’aperçu…
                </div>
              )}

              {previewError && (
                <div className="flex min-h-64 items-center justify-center p-8">
                  <p
                    role="alert"
                    className="max-w-xl rounded-2xl border border-red-300/20 bg-red-500/10 px-5 py-4 text-center text-sm text-red-100"
                  >
                    {previewError}
                  </p>
                </div>
              )}

              {previewUrl && !previewError && activePreview.kind === "video" && (
                <video
                  controls
                  autoPlay
                  playsInline
                  preload="metadata"
                  crossOrigin="anonymous"
                  className="max-h-[76vh] w-full bg-black object-contain"
                  onError={() =>
                    setPreviewError(
                      "La lecture vidéo a échoué. Tu peux toujours télécharger le fichier.",
                    )
                  }
                >
                  <source src={previewUrl} type={activePreview.mimeType} />
                  Ton navigateur ne peut pas lire cette vidéo.
                </video>
              )}

              {previewUrl && !previewError && activePreview.kind === "audio" && (
                <div className="flex min-h-64 items-center justify-center p-6 sm:p-10">
                  <audio
                    controls
                    autoPlay
                    preload="metadata"
                    crossOrigin="anonymous"
                    className="w-full max-w-3xl"
                    onError={() =>
                      setPreviewError(
                        "La lecture audio a échoué. Tu peux toujours télécharger le fichier.",
                      )
                    }
                  >
                    <source src={previewUrl} type={activePreview.mimeType} />
                    Ton navigateur ne peut pas lire ce fichier audio.
                  </audio>
                </div>
              )}

              {previewUrl && !previewError && activePreview.kind === "image" && (
                <div className="flex min-h-64 items-center justify-center p-4 sm:p-6">
                  <Image
                    src={previewUrl}
                    alt={activePreview.file.original_name}
                    width={1600}
                    height={1200}
                    unoptimized
                    className="h-auto max-h-[72vh] w-auto max-w-full object-contain"
                    onError={() =>
                      setPreviewError(
                        "L’image ne peut pas être affichée. Tu peux toujours la télécharger.",
                      )
                    }
                  />
                </div>
              )}

              {previewUrl && !previewError && activePreview.kind === "pdf" && (
                <iframe
                  src={previewUrl}
                  title={`Aperçu de ${activePreview.file.original_name}`}
                  className="h-[72vh] w-full bg-white"
                />
              )}

              {previewUrl && !previewError && activePreview.kind === "text" && (
                <iframe
                  src={previewUrl}
                  title={`Contenu de ${activePreview.file.original_name}`}
                  sandbox=""
                  className="h-[72vh] w-full bg-white"
                />
              )}
            </div>
          </section>
        </div>
      )}
    </DownloadShell>
  );
}
