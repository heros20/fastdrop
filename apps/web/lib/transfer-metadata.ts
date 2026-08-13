import "server-only";

import { cache } from "react";

export type PublicTransferFile = {
  id: string;
  original_name: string;
  size: number;
  mime_type: string | null;
};

export type PublicTransfer = {
  slug: string;
  title: string | null;
  senderName: string | null;
  message: string | null;
  protected: boolean;
  expiresAt: string;
  files: PublicTransferFile[];
};

export const getPublicTransfer = cache(async (slug: string) => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");

  if (!apiUrl) return null;

  try {
    const response = await fetch(
      `${apiUrl}/transfers/${encodeURIComponent(slug)}`,
      { cache: "no-store" },
    );

    if (!response.ok) return null;

    return (await response.json()) as PublicTransfer;
  } catch {
    return null;
  }
});

export function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://fastdrop-seven.vercel.app"
  ).replace(/\/+$/, "");
}

export function getPublicMediaUrl(fileId: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");

  return apiUrl
    ? `${apiUrl}/public-stream/${encodeURIComponent(fileId)}`
    : null;
}
