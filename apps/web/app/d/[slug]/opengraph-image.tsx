import { ImageResponse } from "next/og";
import { getShareableMedia } from "@/lib/shared-media";
import { getPublicTransfer } from "@/lib/transfer-metadata";

export const alt = "Média partagé avec FastDrop";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const transfer = await getPublicTransfer(slug);
  const onlyFile = transfer?.files.length === 1 ? transfer.files[0] : null;
  const media = onlyFile ? getShareableMedia(onlyFile) : null;
  const title = transfer?.title || onlyFile?.original_name || "Partage FastDrop";
  const eyebrow =
    media?.kind === "video"
      ? "VIDÉO À REGARDER"
      : media?.kind === "audio"
        ? "AUDIO À ÉCOUTER"
        : "FICHIERS À TÉLÉCHARGER";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        color: "white",
        padding: "72px",
        background:
          "radial-gradient(circle at 15% 10%, #2563eb 0%, transparent 34%), radial-gradient(circle at 88% 18%, #7c3aed 0%, transparent 32%), #050816",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          fontSize: 34,
          fontWeight: 800,
          letterSpacing: "-1px",
        }}
      >
        Fast
        <span style={{ color: "#60a5fa" }}>Drop</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            color: "#93c5fd",
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: "5px",
          }}
        >
          {eyebrow}
        </div>
        <div
          style={{
            marginTop: 22,
            maxWidth: 1000,
            fontSize: 64,
            fontWeight: 900,
            letterSpacing: "-2px",
            lineHeight: 1.08,
          }}
        >
          {title}
        </div>
        <div style={{ marginTop: 26, color: "#cbd5e1", fontSize: 25 }}>
          {transfer?.senderName
            ? `Partagé par ${transfer.senderName}`
            : "Ouvrir le lien pour accéder au partage"}
        </div>
      </div>
    </div>,
    size,
  );
}
