"use client";

import Image from "next/image";
import { useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL!;

type UploadResponseFile = {
  id: string;
  name: string;
  uploadUrl: string;
};

function formatSize(size: number) {
  if (size < 1024) return `${size} o`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} Ko`;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} Mo`;
  return `${(size / 1024 / 1024 / 1024).toFixed(2)} Go`;
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

  const [files, setFiles] = useState<File[]>([]);
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [password, setPassword] = useState("");
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    setFiles(Array.from(fileList));
    setLink("");
    setProgress(0);
  }

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

  async function createTransfer() {
    if (!files.length) return;

    setLoading(true);
    setProgress(0);
    setLink("");

    try {
      const response = await fetch(`${API}/transfers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: files.length === 1 ? files[0].name : `${files.length} fichiers`,
          expiresInDays,
          password: password.trim() || undefined,
          files: files.map((file) => ({
            name: file.name,
            size: file.size,
            type: file.type,
          })),
        }),
      });

      if (!response.ok) throw new Error("Impossible de créer le transfert.");

      const data = await response.json();
      const uploadFiles: UploadResponseFile[] = data.files;

      for (let i = 0; i < uploadFiles.length; i++) {
        await uploadFile(files[i], uploadFiles[i].uploadUrl, i);
      }

      setProgress(100);
      setLink(data.downloadUrl);
    } catch (error) {
      console.error(error);
      alert("Erreur pendant l'upload.");
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(link);
    alert("Lien copié.");
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);

  return (
    <main className="fastdrop-bg relative min-h-screen overflow-hidden text-white">
      <div className="noise pointer-events-none absolute inset-0 opacity-30" />

      <div className="glow-pulse pointer-events-none absolute left-1/2 top-20 h-80 w-80 -translate-x-1/2 rounded-full bg-blue-500/30 blur-[120px]" />
      <div className="pointer-events-none absolute right-[-10%] top-32 h-96 w-96 rounded-full bg-violet-600/20 blur-[140px]" />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 scale-150 rounded-full bg-blue-500/40 blur-xl" />

            <Image
              src="/logo.svg"
              alt="FastDrop"
              width={52}
              height={52}
              priority
              className="relative transition-transform duration-300 hover:scale-105 drop-shadow-[0_0_28px_rgba(59,130,246,.45)]"
            />
          </div>

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
                "group flex min-h-72 cursor-pointer flex-col items-center justify-center rounded-[1.5rem] border border-dashed p-8 text-center transition duration-300",
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
                onChange={(event) => addFiles(event.target.files)}
              />

              <Image
                src="/logo.svg"
                alt=""
                width={76}
                height={76}
                className="logo-float mb-5 drop-shadow-[0_0_35px_rgba(139,92,246,0.55)]"
              />

              <h2 className="text-3xl font-bold">Glisse tes fichiers ici</h2>
              <p className="mt-2 text-white/50">ou clique pour sélectionner</p>

              <button
                type="button"
                className="mt-7 rounded-2xl bg-gradient-to-r from-blue-500 to-violet-600 px-6 py-3 font-semibold shadow-[0_15px_45px_rgba(79,70,229,0.35)] transition group-hover:-translate-y-1"
              >
                Choisir des fichiers
              </button>
            </div>

            {files.length > 0 && (
              <div className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-semibold">Fichiers sélectionnés</h3>
                    <span className="rounded-full bg-violet-500/20 px-3 py-1 text-sm text-violet-200">
                      {files.length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {files.map((file) => (
                      <div
                        key={`${file.name}-${file.size}`}
                        className="flex items-center justify-between rounded-2xl border border-white/5 bg-black/25 px-4 py-3"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-xl">
                            {getFileIcon(file)}
                          </span>

                          <span className="truncate pr-4 text-sm">{file.name}</span>
                        </div>

                        <span className="shrink-0 text-sm text-blue-200">
                          {formatSize(file.size)}
                        </span>
                      </div>
                    ))}

                    <div className="flex justify-between rounded-2xl bg-black/35 px-4 py-3 font-semibold">
                      <span>Total</span>
                      <span className="text-blue-300">{formatSize(totalSize)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
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
                      <option value={30}>30 jours</option>
                    </select>
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
                </div>

                {loading && (
                  <div className="lg:col-span-2">
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

                <button
                  onClick={createTransfer}
                  disabled={loading}
                  className="lg:col-span-2 w-full rounded-2xl bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-600 px-6 py-4 text-lg font-bold text-white shadow-[0_18px_55px_rgba(79,70,229,0.35)] transition hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(79,70,229,0.5)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Upload en cours..." : "Créer le lien de partage"}
                </button>
              </div>
            )}

            {link && (
              <div className="mt-6 rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-5">
                <h3 className="mb-3 font-semibold text-emerald-200">Upload terminé</h3>

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
              </div>
            )}
          </div>
        </div>

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