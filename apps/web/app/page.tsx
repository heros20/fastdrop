"use client";

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

export default function Home() {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [password, setPassword] = useState("");
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

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
        headers: {
          "Content-Type": "application/json",
        },
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

      if (!response.ok) {
        throw new Error("Impossible de créer le transfert.");
      }

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
    <main className="min-h-screen bg-[#070A12] text-white">
      <section className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6 py-12">
        <div className="mb-10 text-center">
          <div className="mb-4 inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70">
            FastDrop — partage privé de fichiers
          </div>

          <h1 className="text-5xl font-bold tracking-tight md:text-7xl">
            Envoie tes gros fichiers.
          </h1>

          <p className="mt-5 text-lg text-white/60">
            Simple, rapide, sans blabla. Tu déposes, tu copies le lien, terminé.
          </p>
        </div>

        <div className="w-full rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur">
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              addFiles(event.dataTransfer.files);
            }}
            className="flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-black/20 p-8 text-center transition hover:border-white/40 hover:bg-white/[0.06]"
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => addFiles(event.target.files)}
            />

            <div className="mb-4 text-5xl">⬆️</div>
            <h2 className="text-2xl font-semibold">Glisse tes fichiers ici</h2>
            <p className="mt-2 text-white/50">ou clique pour sélectionner</p>
          </div>

          {files.length > 0 && (
            <div className="mt-6 space-y-5">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold">Fichiers</h3>
                  <span className="text-sm text-white/50">
                    {files.length} fichier(s) — {formatSize(totalSize)}
                  </span>
                </div>

                <div className="space-y-2">
                  {files.map((file) => (
                    <div
                      key={`${file.name}-${file.size}`}
                      className="flex items-center justify-between rounded-xl bg-white/[0.04] px-4 py-3"
                    >
                      <span className="truncate pr-4">{file.name}</span>
                      <span className="shrink-0 text-sm text-white/50">
                        {formatSize(file.size)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm text-white/60">Expiration</span>
                  <select
                    value={expiresInDays}
                    onChange={(event) => setExpiresInDays(Number(event.target.value))}
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none"
                  >
                    <option value={1}>24 heures</option>
                    <option value={7}>7 jours</option>
                    <option value={30}>30 jours</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm text-white/60">
                    Mot de passe optionnel
                  </span>
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type="password"
                    placeholder="Laisser vide si inutile"
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none placeholder:text-white/30"
                  />
                </label>
              </div>

              {loading && (
                <div>
                  <div className="mb-2 flex justify-between text-sm text-white/60">
                    <span>Upload en cours</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-white transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              <button
                onClick={createTransfer}
                disabled={loading}
                className="w-full rounded-2xl bg-white px-6 py-4 font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Upload..." : "Créer le lien"}
              </button>
            </div>
          )}

          {link && (
            <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-5">
              <h3 className="mb-3 font-semibold text-emerald-200">Upload terminé</h3>

              <div className="flex gap-2">
                <input
                  value={link}
                  readOnly
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none"
                />

                <button
                  onClick={copyLink}
                  className="rounded-xl bg-white px-5 py-3 font-semibold text-black"
                >
                  Copier
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}