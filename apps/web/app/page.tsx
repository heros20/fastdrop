"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL!;
const MAX_FILE_COUNT = 20;
const MAX_TOTAL_SIZE = 2 * 1024 * 1024 * 1024;
const MAX_EXPIRATION_DAYS = 30;
const TRANSFER_HISTORY_KEY = "fastdrop:transfer-history";
const MAX_HISTORY_ITEMS = 10;

type UploadResponseFile = {
  id: string;
  name: string;
  uploadUrl?: string;
  startUrl?: string;
  uploadPartUrl?: string;
  completeUrl?: string;
  abortUrl?: string;
};

type UploadResponse = {
  slug: string;
  downloadUrl: string;
  manageUrl?: string;
  files: UploadResponseFile[];
};

type UploadedPart = {
  partNumber: number;
  etag: string;
  size: number;
};

type StartUploadResponse = {
  status: "uploading" | "uploaded";
  uploadId?: string;
  partSize: number;
  uploadedParts: UploadedPart[];
};

type TransferHistoryItem = {
  id: string;
  title: string;
  createdAt: string;
  expiresAt: string;
  downloadUrl: string;
  manageUrl: string;
};

function formatSize(size: number) {
  if (size < 1024) return `${size} o`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} Ko`;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} Mo`;
  return `${(size / 1024 / 1024 / 1024).toFixed(2)} Go`;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
}

function getExpirationDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function getFileIcon(file: File) {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  if (type.startsWith("image/")) return "🖼️";
  if (type.startsWith("video/")) return "🎬";
  if (type.startsWith("audio/")) return "🎵";

  if (name.endsWith(".zip") || name.endsWith(".rar") || name.endsWith(".7z")) return "🗜️";
  if (name.endsWith(".pdf")) return "📕";
  if (name.endsWith(".doc") || name.endsWith(".docx")) return "📘";
  if (name.endsWith(".xls") || name.endsWith(".xlsx") || name.endsWith(".csv")) return "📗";
  if (name.endsWith(".ppt") || name.endsWith(".pptx")) return "📙";

  if (
    name.endsWith(".js") ||
    name.endsWith(".ts") ||
    name.endsWith(".tsx") ||
    name.endsWith(".jsx") ||
    name.endsWith(".html") ||
    name.endsWith(".css") ||
    name.endsWith(".json") ||
    name.endsWith(".svg") ||
    name.endsWith(".xml") ||
    name.endsWith(".md")
  ) {
    return "💻";
  }

  return "📄";
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();

  const [files, setFiles] = useState<File[]>([]);
  const [transferName, setTransferName] = useState("");
  const [senderName, setSenderName] = useState("");
  const [transferMessage, setTransferMessage] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [password, setPassword] = useState("");
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [recentTransfers, setRecentTransfers] = useState<TransferHistoryItem[]>(
    () => {
      if (typeof window === "undefined") return [];

      try {
        const storedHistory = window.localStorage.getItem(TRANSFER_HISTORY_KEY);

        if (!storedHistory) return [];

        const parsedHistory = JSON.parse(storedHistory) as TransferHistoryItem[];

        return Array.isArray(parsedHistory) ? parsedHistory : [];
      } catch {
        return [];
      }
    },
  );

  function saveTransferHistory(entry: TransferHistoryItem) {
    setRecentTransfers((currentHistory) => {
      const nextHistory = [
        entry,
        ...currentHistory.filter(
          (item) => item.downloadUrl !== entry.downloadUrl,
        ),
      ].slice(0, MAX_HISTORY_ITEMS);

      window.localStorage.setItem(
        TRANSFER_HISTORY_KEY,
        JSON.stringify(nextHistory),
      );

      return nextHistory;
    });
  }

  function removeHistoryItem(id: string) {
    setRecentTransfers((currentHistory) => {
      const nextHistory = currentHistory.filter((item) => item.id !== id);
      window.localStorage.setItem(
        TRANSFER_HISTORY_KEY,
        JSON.stringify(nextHistory),
      );
      return nextHistory;
    });
  }

  function clearTransferHistory() {
    setRecentTransfers([]);
    window.localStorage.removeItem(TRANSFER_HISTORY_KEY);
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const nextFiles = Array.from(fileList);
    if (!nextFiles.length) return;

    setFiles((currentFiles) => {
      const existingKeys = new Set(
        currentFiles.map((file) => `${file.name}-${file.size}-${file.lastModified}`),
      );
      const uniqueNewFiles = nextFiles.filter(
        (file) => !existingKeys.has(`${file.name}-${file.size}-${file.lastModified}`),
      );
      const allowedSlots = Math.max(MAX_FILE_COUNT - currentFiles.length, 0);
      const filesWithinCount = uniqueNewFiles.slice(0, allowedSlots);
      const acceptedFiles: File[] = [];
      let nextTotalSize = currentFiles.reduce((sum, file) => sum + file.size, 0);

      for (const file of filesWithinCount) {
        if (nextTotalSize + file.size <= MAX_TOTAL_SIZE) {
          acceptedFiles.push(file);
          nextTotalSize += file.size;
        }
      }

      const skippedCount =
        uniqueNewFiles.length - acceptedFiles.length;

      if (skippedCount > 0) {
        alert(
          `Certains fichiers n'ont pas été ajoutés. Limites : ${MAX_FILE_COUNT} fichiers, ${formatSize(MAX_TOTAL_SIZE)} maximum par transfert.`,
        );
      }

      return [
        ...currentFiles,
        ...acceptedFiles,
      ];
    });
    setProgress(0);
  }

  function removeFile(indexToRemove: number) {
    setFiles((currentFiles) =>
      currentFiles.filter((_, index) => index !== indexToRemove),
    );
    setProgress(0);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function uploadFile(file: File, uploadUrl: string, index: number) {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const fileProgress = event.loaded / event.total;
        const globalProgress = ((index + fileProgress) / files.length) * 100;
        setProgress(Math.round(globalProgress));
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload échoué : ${xhr.status}`));
      };

      xhr.onerror = () => reject(new Error("Erreur réseau pendant l'upload."));

      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      xhr.send(file);
    });
  }

  async function uploadMultipartPart(
    part: Blob,
    uploadUrl: string,
    onProgress: (loaded: number) => void,
  ) {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        onProgress(event.loaded);
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload echoue : ${xhr.status}`));
      };

      xhr.onerror = () => reject(new Error("Erreur reseau pendant l'upload."));

      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", "application/octet-stream");
      xhr.send(part);
    });
  }

  async function uploadFileMultipart(
    file: File,
    uploadFileData: UploadResponseFile,
    completedBeforeFile: number,
    transferSize: number,
  ) {
    if (!uploadFileData.startUrl && uploadFileData.uploadUrl) {
      await uploadMultipartPart(file, uploadFileData.uploadUrl, (loaded) => {
        setProgress(
          Math.round(((completedBeforeFile + loaded) / transferSize) * 100),
        );
      });
      return;
    }

    if (
      !uploadFileData.startUrl ||
      !uploadFileData.uploadPartUrl ||
      !uploadFileData.completeUrl
    ) {
      throw new Error("Configuration d'upload incomplète.");
    }

    const startResponse = await fetch(uploadFileData.startUrl, {
      method: "POST",
    });

    if (!startResponse.ok) {
      throw new Error("Impossible de demarrer l'upload multipart.");
    }

    const uploadState = (await startResponse.json()) as StartUploadResponse;

    if (uploadState.status === "uploaded") {
      setProgress(Math.round(((completedBeforeFile + file.size) / transferSize) * 100));
      return;
    }

    if (!uploadState.uploadId) {
      throw new Error("Session d'upload multipart manquante.");
    }

    const uploadedParts = new Set(
      uploadState.uploadedParts.map((part) => part.partNumber),
    );
    let completedFileBytes = uploadState.uploadedParts.reduce(
      (sum, part) => sum + part.size,
      0,
    );

    setProgress(Math.round(((completedBeforeFile + completedFileBytes) / transferSize) * 100));

    const partSize = uploadState.partSize;
    const partCount = Math.ceil(file.size / partSize);

    for (let partNumber = 1; partNumber <= partCount; partNumber++) {
      if (uploadedParts.has(partNumber)) continue;

      const start = (partNumber - 1) * partSize;
      const end = Math.min(start + partSize, file.size);
      const part = file.slice(start, end);
      let currentPartLoaded = 0;

      await uploadMultipartPart(
        part,
        `${uploadFileData.uploadPartUrl}/${partNumber}?uploadId=${encodeURIComponent(
          uploadState.uploadId,
        )}`,
        (loaded) => {
          currentPartLoaded = loaded;
          const uploadedBytes =
            completedBeforeFile + completedFileBytes + currentPartLoaded;
          setProgress(Math.min(99, Math.round((uploadedBytes / transferSize) * 100)));
        },
      );

      completedFileBytes += part.size;
      setProgress(Math.round(((completedBeforeFile + completedFileBytes) / transferSize) * 100));
    }

    const completeResponse = await fetch(uploadFileData.completeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uploadId: uploadState.uploadId,
      }),
    });

    if (!completeResponse.ok) {
      const errorData = (await completeResponse.json().catch(() => null)) as {
        error?: string;
      } | null;

      throw new Error(errorData?.error ?? "Impossible de finaliser l'upload.");
    }
  }

  async function createTransfer() {
    if (!files.length) return;
    if (files.length > MAX_FILE_COUNT || totalSize > MAX_TOTAL_SIZE) {
      alert(
        `Transfert trop volumineux. Limites : ${MAX_FILE_COUNT} fichiers, ${formatSize(MAX_TOTAL_SIZE)} maximum.`,
      );
      return;
    }

    setLoading(true);
    setProgress(0);

    try {
      const title =
        transferName.trim() ||
        (files.length === 1 ? files[0].name : `${files.length} fichiers`);

      const response = await fetch(`${API}/transfers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          senderName: senderName.trim() || undefined,
          message: transferMessage.trim() || undefined,
          expiresInDays,
          password: password.trim() || undefined,
          files: files.map((file) => ({
            name: file.name,
            size: file.size,
            type: file.type,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;

        throw new Error(errorData?.error ?? "Impossible de créer le transfert.");
      }

      const data = (await response.json()) as UploadResponse;
      const uploadFiles = data.files;
      let completedBytes = 0;

      for (let i = 0; i < uploadFiles.length; i++) {
        await uploadFileMultipart(files[i], uploadFiles[i], completedBytes, totalSize);
        completedBytes += files[i].size;
      }

      saveTransferHistory({
        id: data.slug,
        title,
        createdAt: new Date().toISOString(),
        expiresAt: expirationDate.toISOString(),
        downloadUrl: data.downloadUrl,
        manageUrl: data.manageUrl ?? data.downloadUrl,
      });

      setProgress(100);

      const successParams = new URLSearchParams({
        link: data.downloadUrl,
        manage: data.manageUrl ?? data.downloadUrl,
        title,
        expiresAt: expirationDate.toISOString(),
        files: String(files.length),
        size: String(totalSize),
      });

      router.push(`/upload-complete?${successParams.toString()}`);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Erreur pendant l'upload.");
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(link);
    alert("Lien copié.");
  }

  async function copyHistoryLink(url: string) {
    await navigator.clipboard.writeText(url);
    alert("Lien copié.");
  }

  async function shareWithDevice() {
    if (navigator.share) {
      await navigator.share({
        title: "FastDrop",
        text: "Voici mon lien FastDrop",
        url: link,
      });
      return;
    }

    await copyLink();
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const expirationDate = getExpirationDate(expiresInDays);
  const isOverLimit = files.length > MAX_FILE_COUNT || totalSize > MAX_TOTAL_SIZE;

  return (
    <main className="fastdrop-bg relative min-h-screen overflow-hidden text-white">
      <div className="noise pointer-events-none absolute inset-0 opacity-30" />

      <div className="glow-pulse pointer-events-none absolute left-1/2 top-20 h-80 w-80 -translate-x-1/2 rounded-full bg-blue-500/30 blur-[120px]" />
      <div className="pointer-events-none absolute right-[-10%] top-32 h-96 w-96 rounded-full bg-violet-600/20 blur-[140px]" />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="relative block" aria-label="Accueil FastDrop">
            <div className="absolute inset-0 scale-150 rounded-full bg-blue-500/40 blur-xl" />

            <Image
              src="/fd-logo.png"
              alt="FastDrop"
              width={52}
              height={52}
              priority
              className="relative transition-transform duration-300 hover:scale-105 drop-shadow-[0_0_28px_rgba(59,130,246,.45)]"
            />
          </Link>

          <div>
            <h2 className="text-2xl font-black tracking-tight">
              <span className="text-white">Fast</span>
              <span className="bg-gradient-to-r from-sky-400 via-blue-400 to-violet-500 bg-clip-text text-transparent">
                Drop
              </span>
            </h2>

            <p className="text-xs uppercase tracking-[0.30em] text-white/35">
              Personal Cloud
            </p>
          </div>
        </div>

        <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/50">
          Privé · Simple · Rapide
        </div>
      </header>

      <section className="relative z-10 mx-auto flex max-w-6xl flex-col items-center px-6 pb-14 pt-6">
        <div className="mb-8 text-center">
          <h1 className="text-5xl font-black tracking-tight md:text-7xl">
            Envoie tes{" "}
            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-violet-500 bg-clip-text text-transparent">
              gros fichiers.
            </span>
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-300">
            Simple, rapide. Tu déposes, tu copies le lien, terminé.
          </p>

          <div className="mx-auto mt-8 grid max-w-3xl gap-3 md:grid-cols-3">
            {[
              ["Privé", "Tes fichiers restent à toi"],
              ["Rapide", "Upload et téléchargement"],
              ["Contrôlé", "Expiration et mot de passe"],
            ].map(([title, text]) => (
              <div
                key={title}
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left backdrop-blur"
              >
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="mt-1 text-xs text-white/45">{text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="gradient-border w-full rounded-[2rem] p-[1px] shadow-[0_0_80px_rgba(37,99,235,0.16)]">
          <div className="rounded-[2rem] bg-[#070b18]/90 p-5 backdrop-blur-xl md:p-7">
            <div
              onClick={() => inputRef.current?.click()}
              onDragEnter={() => setIsDragging(true)}
              onDragLeave={() => setIsDragging(false)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                addFiles(event.dataTransfer.files);
              }}
              className={[
                "group flex cursor-pointer flex-col items-center justify-center rounded-[1.5rem] border border-dashed text-center transition duration-300",
                files.length > 0 ? "min-h-40 p-5" : "min-h-72 p-8",
                isDragging
                  ? "scale-[1.015] border-violet-400 bg-violet-500/10"
                  : "border-white/15 bg-black/25 hover:scale-[1.01] hover:border-blue-400/70 hover:bg-white/[0.05]",
              ].join(" ")}
            >
              <input
                ref={inputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(event) => {
                  addFiles(event.target.files);
                  event.target.value = "";
                }}
              />

              <Image
                src="/fd-logo.png"
                alt=""
                width={files.length > 0 ? 52 : 76}
                height={files.length > 0 ? 52 : 76}
                className={[
                  "logo-float drop-shadow-[0_0_35px_rgba(139,92,246,0.55)]",
                  files.length > 0 ? "mb-3" : "mb-5",
                ].join(" ")}
              />

              <h2 className={files.length > 0 ? "text-xl font-bold" : "text-3xl font-bold"}>
                Glisse tes fichiers ici
              </h2>
              <p className="mt-2 text-white/50">ou clique pour sélectionner</p>

              <div
                className={[
                  "grid w-full max-w-2xl gap-2 text-left text-xs text-white/55 sm:grid-cols-3",
                  files.length > 0 ? "mt-4 hidden md:grid" : "mt-6",
                ].join(" ")}
              >
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <p className="font-semibold text-white/75">Taille max</p>
                  <p className="mt-1">{formatSize(MAX_TOTAL_SIZE)} par transfert</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <p className="font-semibold text-white/75">Fichiers max</p>
                  <p className="mt-1">{MAX_FILE_COUNT} fichiers</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <p className="font-semibold text-white/75">Durée max</p>
                  <p className="mt-1">{MAX_EXPIRATION_DAYS} jours</p>
                </div>
              </div>

              <button
                type="button"
                className={[
                  "rounded-2xl bg-gradient-to-r from-blue-500 to-violet-600 font-semibold shadow-[0_15px_45px_rgba(79,70,229,0.35)] transition group-hover:-translate-y-1",
                  files.length > 0 ? "mt-4 px-5 py-2.5 text-sm" : "mt-7 px-6 py-3",
                ].join(" ")}
              >
                Choisir des fichiers
              </button>
            </div>

            {files.length > 0 && (
              <div className="mt-5 grid gap-4">
                <div className="order-2 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-semibold">Fichiers sélectionnés</h3>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setFiles([]);
                          setProgress(0);
                        }}
                        disabled={loading}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/55 transition hover:border-red-300/40 hover:bg-red-500/15 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Tout vider
                      </button>

                      <span className="rounded-full bg-violet-500/20 px-3 py-1 text-sm text-violet-200">
                        {files.length}/{MAX_FILE_COUNT}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {files.map((file, index) => (
                      <div
                        key={`${file.name}-${file.size}-${file.lastModified}`}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-black/25 px-4 py-3"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-xl">
                            {getFileIcon(file)}
                          </span>

                          <span className="truncate pr-4 text-sm">{file.name}</span>
                        </div>

                        <div className="flex shrink-0 items-center gap-3">
                          <span className="text-sm text-blue-200">
                            {formatSize(file.size)}
                          </span>

                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            disabled={loading}
                            aria-label={`Retirer ${file.name}`}
                            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg leading-none text-white/60 transition hover:border-red-300/50 hover:bg-red-500/15 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}

                    <div className="flex justify-between rounded-2xl bg-black/35 px-4 py-3 font-semibold">
                      <span>Total</span>
                      <span className={isOverLimit ? "text-red-200" : "text-blue-300"}>
                        {formatSize(totalSize)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="order-1 grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <label className="block rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                    <span className="mb-3 block text-sm font-semibold text-white/80">
                      Nom du transfert
                    </span>
                    <input
                      value={transferName}
                      onChange={(event) => setTransferName(event.target.value)}
                      type="text"
                      maxLength={80}
                      placeholder="Ex : Photos chantier Sandouville"
                      className="w-full rounded-2xl border border-white/10 bg-[#080d1b] px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-blue-400 focus:shadow-[0_0_30px_rgba(59,130,246,0.25)]"
                    />
                    <p className="mt-3 text-xs text-white/40">
                      Optionnel. Affiché sur la page de téléchargement.
                    </p>
                  </label>

                  <label className="block rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                    <span className="mb-3 block text-sm font-semibold text-white/80">
                      Nom de l&apos;expéditeur
                    </span>
                    <input
                      value={senderName}
                      onChange={(event) => setSenderName(event.target.value)}
                      type="text"
                      maxLength={80}
                      placeholder="Ex : Kevin Bigoni"
                      className="w-full rounded-2xl border border-white/10 bg-[#080d1b] px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-blue-400 focus:shadow-[0_0_30px_rgba(59,130,246,0.25)]"
                    />
                    <p className="mt-3 text-xs text-white/40">
                      Optionnel. Affiché aux destinataires.
                    </p>
                  </label>

                  <label className="block rounded-3xl border border-white/10 bg-white/[0.04] p-5 md:col-span-2 xl:col-span-2 xl:row-span-2">
                    <span className="mb-3 block text-sm font-semibold text-white/80">
                      Message optionnel
                    </span>
                    <textarea
                      value={transferMessage}
                      onChange={(event) => setTransferMessage(event.target.value)}
                      maxLength={1000}
                      rows={5}
                      placeholder={"Bonjour,\nvous trouverez ci-joint les photos et documents demandés.\nCordialement."}
                      className="w-full resize-none rounded-2xl border border-white/10 bg-[#080d1b] px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-blue-400 focus:shadow-[0_0_30px_rgba(59,130,246,0.25)]"
                    />
                    <p className="mt-3 text-xs text-white/40">
                      {transferMessage.length}/1000 caractères
                    </p>
                  </label>

                  <label className="block rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                    <span className="mb-3 block text-sm font-semibold text-white/80">
                      Expiration du lien
                    </span>
                    <select
                      value={expiresInDays}
                      onChange={(event) => setExpiresInDays(Number(event.target.value))}
                      className="w-full rounded-2xl border border-white/10 bg-[#080d1b] px-4 py-3 text-white outline-none transition focus:border-blue-400 focus:shadow-[0_0_30px_rgba(59,130,246,0.25)]"
                    >
                      <option value={1}>24 heures</option>
                      <option value={7}>7 jours</option>
                      <option value={MAX_EXPIRATION_DAYS}>
                        {MAX_EXPIRATION_DAYS} jours
                      </option>
                    </select>

                    <p className="mt-3 rounded-2xl border border-blue-400/15 bg-blue-400/10 px-4 py-3 text-sm leading-6 text-blue-100">
                      Disponible jusqu&apos;au {formatDate(expirationDate)}
                    </p>
                  </label>

                  <label className="block rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                    <span className="mb-3 block text-sm font-semibold text-white/80">
                      Mot de passe optionnel
                    </span>
                    <input
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      type="password"
                      placeholder="Laisser vide si inutile"
                      className="w-full rounded-2xl border border-white/10 bg-[#080d1b] px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-violet-400 focus:shadow-[0_0_30px_rgba(139,92,246,0.25)]"
                    />
                  </label>

                  <button
                    onClick={createTransfer}
                    disabled={loading || isOverLimit}
                    className="w-full rounded-2xl bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-600 px-6 py-4 text-base font-bold text-white shadow-[0_18px_55px_rgba(79,70,229,0.35)] transition hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(79,70,229,0.5)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? "Upload en cours..." : "Créer le lien de partage"}
                  </button>
                </div>

                {loading && (
                  <div className="order-3">
                    <div className="mb-2 flex justify-between text-sm text-white/60">
                      <span>Upload en cours</span>
                      <span>{progress}%</span>
                    </div>

                    <div className="h-4 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-600 transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

              </div>
            )}

            {false && (
              <div className="mt-6 rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-5">
                <h3 className="mb-3 font-semibold text-emerald-200">Upload terminé</h3>

                <div className="mb-4 grid gap-3 text-sm sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                    <p className="text-white/45">Expiration</p>
                    <p className="mt-1 font-semibold text-white">
                      {formatDate(expirationDate)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                    <p className="text-white/45">Taille totale</p>
                    <p className="mt-1 font-semibold text-white">
                      {formatSize(totalSize)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                    <p className="text-white/45">Fichiers</p>
                    <p className="mt-1 font-semibold text-white">{files.length}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 md:flex-row">
                  <input
                    value={link}
                    readOnly
                    className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none"
                  />

                  <button
                    onClick={copyLink}
                    className="rounded-2xl bg-white px-6 py-3 font-bold text-black transition hover:bg-blue-100"
                  >
                    Copier
                  </button>
                </div>

                <button
                  type="button"
                  onClick={shareWithDevice}
                  className="mt-4 flex w-full flex-col items-center rounded-2xl bg-white px-6 py-3 font-bold text-black transition hover:bg-blue-100 xl:hidden"
                >
                  <span>Partager</span>
                  <span className="mt-0.5 text-xs font-semibold text-black/55">
                    Partager avec une app
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFiles([]);
                    setTransferName("");
                    setSenderName("");
                    setTransferMessage("");
                    setPassword("");
                    setLink("");
                    setProgress(0);
                    inputRef.current?.focus();
                  }}
                  className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/70 transition hover:border-blue-300/40 hover:bg-white/10 hover:text-white"
                >
                  Créer un nouveau transfert
                </button>
              </div>
            )}
          </div>
        </div>

        {recentTransfers.length > 0 && (
          <section className="mt-8 w-full rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl md:p-7">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black tracking-tight">Mes derniers liens</h2>
                <p className="mt-1 text-sm text-white/45">
                  Historique enregistré uniquement dans ce navigateur.
                </p>
              </div>

              <button
                type="button"
                onClick={clearTransferHistory}
                className="self-start rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/55 transition hover:border-red-300/40 hover:bg-red-500/15 hover:text-red-100 sm:self-auto"
              >
                Vider l&apos;historique
              </button>
            </div>

            <div className="space-y-3">
              {recentTransfers.map((transfer) => (
                <div
                  key={transfer.id}
                  className="grid gap-4 rounded-2xl border border-white/10 bg-black/25 p-4 lg:grid-cols-[1fr_auto]"
                >
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-white">
                      {transfer.title}
                    </h3>

                    <div className="mt-2 grid gap-2 text-xs text-white/45 sm:grid-cols-2">
                      <p>
                        Créé le{" "}
                        <span className="text-white/70">
                          {formatDate(new Date(transfer.createdAt))}
                        </span>
                      </p>
                      <p>
                        Expire le{" "}
                        <span className="text-white/70">
                          {formatDate(new Date(transfer.expiresAt))}
                        </span>
                      </p>
                    </div>

                    <p className="mt-3 truncate rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-blue-100/80">
                      {transfer.downloadUrl}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <a
                      href={transfer.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-black transition hover:bg-blue-100"
                    >
                      Ouvrir
                    </a>

                    <button
                      type="button"
                      onClick={() => copyHistoryLink(transfer.downloadUrl)}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/70 transition hover:border-blue-300/40 hover:bg-white/10 hover:text-white"
                    >
                      Copier
                    </button>

                    <a
                      href={transfer.manageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/70 transition hover:border-violet-300/40 hover:bg-white/10 hover:text-white"
                    >
                      Gestion
                    </a>

                    <button
                      type="button"
                      onClick={() => removeHistoryItem(transfer.id)}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/45 transition hover:border-red-300/40 hover:bg-red-500/15 hover:text-red-100"
                    >
                      Retirer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

       <footer className="mt-10 flex flex-col items-center gap-4 text-center">
  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-white/70 shadow-2xl backdrop-blur">
    <span className="h-2 w-2 rounded-full bg-blue-400 shadow-[0_0_18px_rgba(96,165,250,0.9)]" />
    PERSONAL CLOUD
  </div>

  <a
    href="https://heros20.github.io/Portfolio-2.0/"
    target="_blank"
    rel="noopener noreferrer"
    className="group inline-flex items-center gap-2 text-sm text-white/40 transition hover:text-white"
  >
    <Image
      src="/logo.svg"
      alt="KB"
      width={26}
      height={26}
      className="transition-transform duration-300 group-hover:scale-110"
    />

    <span>
      Site réalisé par <strong className="font-semibold">KB</strong>
    </span>
  </a>
</footer>
      </section>
    </main>
  );
}
