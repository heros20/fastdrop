"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

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
  protected: boolean;
  expiresAt: string;
  files: TransferFile[];
};

function formatSize(size: number) {
  if (size < 1024) return `${size} o`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} Ko`;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} Mo`;
  return `${(size / 1024 / 1024 / 1024).toFixed(2)} Go`;
}

export default function DownloadPage() {
  const params = useParams<{ slug: string }>();

  const [transfer, setTransfer] = useState<Transfer | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadTransfer() {
      try {
        const response = await fetch(`${API}/transfers/${params.slug}`);

        if (!response.ok) {
          throw new Error("Transfert introuvable ou expiré.");
        }

        const data = await response.json();
        setTransfer(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue.");
      }
    }

    loadTransfer();
  }, [params.slug]);

  async function downloadFile(file: TransferFile) {
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
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#070A12] px-6 text-white">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
          <h1 className="text-3xl font-bold">Lien indisponible</h1>
          <p className="mt-3 text-white/60">{error}</p>
        </div>
      </main>
    );
  }

  if (!transfer) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#070A12] text-white">
        Chargement...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#070A12] px-6 py-12 text-white">
      <section className="mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70">
            FastDrop
          </div>

          <h1 className="text-4xl font-bold">Fichiers disponibles</h1>

          <p className="mt-3 text-white/50">
            Expire le {new Date(transfer.expiresAt).toLocaleDateString("fr-FR")}
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl">
          {transfer.protected && (
            <label className="mb-6 block">
              <span className="mb-2 block text-sm text-white/60">Mot de passe</span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none"
              />
            </label>
          )}

          <div className="space-y-3">
            {transfer.files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{file.original_name}</p>
                  <p className="text-sm text-white/50">{formatSize(file.size)}</p>
                </div>

                <button
                  onClick={() => downloadFile(file)}
                  className="shrink-0 rounded-xl bg-white px-4 py-2 font-semibold text-black transition hover:bg-white/90"
                >
                  Télécharger
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}