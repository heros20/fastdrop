import type { Metadata } from "next";
import DownloadPageClient from "./download-page-client";
import { getShareableMedia } from "@/lib/shared-media";
import {
  getPublicMediaUrl,
  getPublicTransfer,
  getSiteUrl,
} from "@/lib/transfer-metadata";

type DownloadPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: DownloadPageProps): Promise<Metadata> {
  const { slug } = await params;
  const transfer = await getPublicTransfer(slug);
  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}/d/${encodeURIComponent(slug)}`;
  const imageUrl = `${pageUrl}/opengraph-image`;

  if (!transfer) {
    return {
      title: "Transfert indisponible",
      description: "Ce lien FastDrop n’est plus disponible.",
      robots: { index: false, follow: false },
    };
  }

  const onlyFile = transfer.files.length === 1 ? transfer.files[0] : null;
  const media =
    onlyFile && !transfer.protected ? getShareableMedia(onlyFile) : null;
  const mediaUrl = onlyFile && media ? getPublicMediaUrl(onlyFile.id) : null;
  const title = transfer.title || onlyFile?.original_name || "Fichiers partagés";
  const description = media
    ? `${media.kind === "video" ? "Vidéo" : "Audio"} partagé${
        media.kind === "video" ? "e" : ""
      } via FastDrop${transfer.senderName ? ` par ${transfer.senderName}` : ""}.`
    : `Fichiers partagés via FastDrop${
        transfer.senderName ? ` par ${transfer.senderName}` : ""
      }.`;
  const baseMetadata: Metadata = {
    title,
    description,
    alternates: { canonical: pageUrl },
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: "FastDrop",
      locale: "fr_FR",
      type: "website",
      images: [
        {
          url: imageUrl,
          secureUrl: imageUrl,
          width: 1200,
          height: 630,
          type: "image/png",
          alt: `${title} — FastDrop`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: imageUrl, alt: `${title} — FastDrop` }],
    },
  };

  if (!onlyFile || !media || !mediaUrl) return baseMetadata;

  const playerHeight = media.kind === "video" ? 720 : 360;
  const playerUrl = new URL(`/embed/${encodeURIComponent(onlyFile.id)}`, siteUrl);
  playerUrl.searchParams.set("kind", media.kind);
  playerUrl.searchParams.set("type", media.mimeType);

  return {
    ...baseMetadata,
    openGraph: {
      ...baseMetadata.openGraph,
      type: media.kind === "video" ? "video.other" : "website",
      ...(media.kind === "video"
        ? {
            videos: [
              {
                url: mediaUrl,
                secureUrl: mediaUrl,
                type: media.mimeType,
                width: 1280,
                height: playerHeight,
              },
            ],
          }
        : {
            audio: [
              {
                url: mediaUrl,
                secureUrl: mediaUrl,
                type: media.mimeType,
              },
            ],
          }),
    },
    twitter: {
      card: "player",
      title,
      description,
      images: [{ url: imageUrl, alt: `${title} — FastDrop` }],
      players: [
        {
          playerUrl: playerUrl.toString(),
          streamUrl: mediaUrl,
          width: 1280,
          height: playerHeight,
        },
      ],
    },
    other: {
      "twitter:player:stream:content_type": media.mimeType,
    },
  };
}

export default function DownloadPage() {
  return <DownloadPageClient />;
}
