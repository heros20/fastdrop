import type { Metadata } from "next";
import { getPublicMediaUrl } from "@/lib/transfer-metadata";

export const metadata: Metadata = {
  title: "Lecteur FastDrop",
  robots: { index: false, follow: false },
};

type EmbedPageProps = {
  params: Promise<{ fileId: string }>;
  searchParams: Promise<{
    kind?: string | string[];
    type?: string | string[];
  }>;
};

export default async function EmbedPage({
  params,
  searchParams,
}: EmbedPageProps) {
  const [{ fileId }, query] = await Promise.all([params, searchParams]);
  const requestedKind = Array.isArray(query.kind) ? query.kind[0] : query.kind;
  const requestedType = Array.isArray(query.type) ? query.type[0] : query.type;
  const kind = requestedKind === "audio" ? "audio" : "video";
  const fallbackType = kind === "audio" ? "audio/mpeg" : "video/mp4";
  const mimeType = requestedType?.startsWith(`${kind}/`)
    ? requestedType
    : fallbackType;
  const mediaUrl = getPublicMediaUrl(fileId);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050816] p-4 text-white">
      {!mediaUrl ? (
        <p className="text-sm text-white/60">Média indisponible.</p>
      ) : kind === "video" ? (
        <video
          controls
          playsInline
          preload="metadata"
          crossOrigin="anonymous"
          className="max-h-screen w-full bg-black object-contain"
        >
          <source src={mediaUrl} type={mimeType} />
          Ton navigateur ne peut pas lire cette vidéo.
        </video>
      ) : (
        <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl">
          <p className="mb-5 text-center text-sm font-semibold uppercase tracking-[0.25em] text-blue-200/70">
            Écouter avec FastDrop
          </p>
          <audio
            controls
            preload="metadata"
            crossOrigin="anonymous"
            className="w-full"
          >
            <source src={mediaUrl} type={mimeType} />
            Ton navigateur ne peut pas lire ce fichier audio.
          </audio>
        </div>
      )}
    </main>
  );
}
