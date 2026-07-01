"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function formatSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "0 o";
  if (size < 1024) return `${size} o`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} Ko`;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} Mo`;
  return `${(size / 1024 / 1024 / 1024).toFixed(2)} Go`;
}

function formatDate(value: string | null) {
  if (!value) return "Non renseignée";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Non renseignée";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
}

function UploadCompleteContent() {
  const searchParams = useSearchParams();
  const link = searchParams.get("link") ?? "";
  const manageUrl = searchParams.get("manage") ?? link;
  const title = searchParams.get("title") ?? "Transfert FastDrop";
  const expiresAt = searchParams.get("expiresAt");
  const fileCount = Number(searchParams.get("files") ?? 0);
  const totalSize = Number(searchParams.get("size") ?? 0);

  async function copyLink() {
    await navigator.clipboard.writeText(link);
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

  if (!link) {
    return (
      <main className="fastdrop-bg relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-10 text-white">
        <div className="noise pointer-events-none absolute inset-0 opacity-30" />
        <div className="relative z-10 max-w-xl rounded-[2rem] border border-white/10 bg-[#070b18]/90 p-8 text-center backdrop-blur-xl">
          <Image src="/fd-logo.png" alt="" width={76} height={76} className="mx-auto mb-5" />
          <h1 className="text-3xl font-black tracking-tight">Lien indisponible</h1>
          <p className="mt-3 text-sm leading-6 text-white/55">
            Le récapitulatif de l&apos;upload n&apos;est plus disponible.
          </p>
          <Link
            href="/"
            className="mt-7 inline-flex rounded-2xl bg-white px-6 py-3 font-bold text-black transition hover:bg-blue-100"
          >
            Créer un nouveau transfert
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="fastdrop-bg relative min-h-screen overflow-hidden px-4 py-8 text-white sm:px-6">
      <div className="noise pointer-events-none absolute inset-0 opacity-30" />
      <div className="glow-pulse pointer-events-none absolute left-1/2 top-20 h-80 w-80 -translate-x-1/2 rounded-full bg-blue-500/30 blur-[120px]" />
      <div className="pointer-events-none absolute right-[-10%] top-32 h-96 w-96 rounded-full bg-violet-600/20 blur-[140px]" />

      <header className="relative z-10 mx-auto flex max-w-5xl items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-4" aria-label="Accueil FastDrop">
          <span className="relative block">
            <span className="absolute inset-0 scale-150 rounded-full bg-blue-500/40 blur-xl" />
            <Image
              src="/fd-logo.png"
              alt="FastDrop"
              width={52}
              height={52}
              priority
              className="relative drop-shadow-[0_0_28px_rgba(59,130,246,.45)]"
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
          className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/60 transition hover:border-blue-300/40 hover:bg-white/10 hover:text-white sm:px-4"
        >
          Nouveau transfert
        </Link>
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-5xl min-w-0 flex-col items-center pt-14">
        <div className="mb-8 w-full min-w-0 text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm font-semibold text-emerald-100">
            <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.9)]" />
            Upload terminé
          </div>

          <h1 className="mx-auto max-w-3xl text-4xl font-black tracking-tight md:text-6xl">
            Ton lien est prêt
          </h1>

          <p className="mx-auto mt-4 max-w-2xl break-words text-base leading-7 text-slate-300">
            {title}
          </p>
        </div>

        <div className="gradient-border w-full max-w-full min-w-0 rounded-[2rem] p-[1px] shadow-[0_0_80px_rgba(37,99,235,0.16)]">
          <div className="min-w-0 overflow-hidden rounded-[2rem] bg-[#070b18]/90 p-4 backdrop-blur-xl sm:p-5 md:p-7">
            <div className="mb-4 grid gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-white/45">Expiration</p>
                <p className="mt-1 font-semibold text-white">{formatDate(expiresAt)}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-white/45">Taille totale</p>
                <p className="mt-1 font-semibold text-white">{formatSize(totalSize)}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-white/45">Fichiers</p>
                <p className="mt-1 font-semibold text-white">{fileCount}</p>
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-3 md:flex-row">
              <input
                value={link}
                readOnly
                className="w-full min-w-0 flex-1 truncate rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none"
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

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <a
                href={manageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-center text-sm font-semibold text-white/70 transition hover:border-violet-300/40 hover:bg-white/10 hover:text-white"
              >
                Gérer le transfert
              </a>

              <Link
                href="/"
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-center text-sm font-semibold text-white/70 transition hover:border-blue-300/40 hover:bg-white/10 hover:text-white"
              >
                Créer un nouveau transfert
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function UploadCompletePage() {
  return (
    <Suspense fallback={null}>
      <UploadCompleteContent />
    </Suspense>
  );
}
