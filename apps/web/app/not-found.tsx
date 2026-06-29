import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="fastdrop-bg relative min-h-screen overflow-hidden px-6 py-8 text-white">
      <div className="noise pointer-events-none absolute inset-0 opacity-30" />
      <div className="glow-pulse pointer-events-none absolute left-1/2 top-20 h-80 w-80 -translate-x-1/2 rounded-full bg-blue-500/30 blur-[120px]" />
      <div className="pointer-events-none absolute right-[-10%] top-32 h-96 w-96 rounded-full bg-violet-600/20 blur-[140px]" />

      <section className="relative z-10 mx-auto flex min-h-[85vh] max-w-4xl flex-col items-center justify-center text-center">
        <div className="relative mb-9 h-40 w-40">
          <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-3xl" />
          <Image
            src="/fd-logo.png"
            alt="FastDrop"
            width={112}
            height={112}
            priority
            className="logo-wander absolute left-4 top-4 drop-shadow-[0_0_35px_rgba(139,92,246,0.55)]"
          />
        </div>

        <p className="mb-4 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm uppercase tracking-[0.30em] text-white/55 shadow-2xl backdrop-blur">
          Erreur 404
        </p>

        <h1 className="max-w-3xl text-5xl font-black tracking-tight md:text-7xl">
          Ce lien est introuvable.
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-slate-300">
          Le transfert a peut-être expiré, été supprimé, ou l&apos;adresse contient une erreur.
        </p>

        <Link
          href="/"
          className="mt-8 rounded-2xl bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-600 px-6 py-4 font-bold text-white shadow-[0_18px_55px_rgba(79,70,229,0.35)] transition hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(79,70,229,0.5)]"
        >
          Créer un nouveau transfert
        </Link>
      </section>
    </main>
  );
}
