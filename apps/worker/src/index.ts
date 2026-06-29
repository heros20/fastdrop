import { nanoid } from "nanoid";

export interface Env {
  DB: D1Database;
  FILES_BUCKET: R2Bucket;
  APP_URL: string;
}

type CleanupResult = {
  checkedTransfers: number;
  deletedTransfers: number;
  deletedFiles: number;
};

type ZipFile = {
  r2_key: string;
  original_name: string;
  size: number;
};

type ZipCentralEntry = {
  name: Uint8Array;
  crc32: number;
  compressedSize: number;
  uncompressedSize: number;
  offset: number;
  modifiedTime: number;
  modifiedDate: number;
};

const MAX_FILE_COUNT = 20;
const MAX_TOTAL_SIZE = 2 * 1024 * 1024 * 1024;
const MAX_FILE_SIZE = 500 * 1024 * 1024;
const MAX_EXPIRATION_DAYS = 30;
const MAX_TRANSFER_TITLE_LENGTH = 80;
const MAX_TRANSFER_MESSAGE_LENGTH = 1000;
const textEncoder = new TextEncoder();
const crc32Table = new Uint32Array(256).map((_, index) => {
  let value = index;

  for (let bit = 0; bit < 8; bit++) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }

  return value >>> 0;
});

function getAllowedOrigin(request: Request, env: Env) {
  const origin = request.headers.get("Origin");
  const appOrigin = new URL(env.APP_URL).origin;

  if (!origin) return appOrigin;
  if (origin === appOrigin) return origin;

  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    const isLocalDev =
      (requestUrl.hostname === "localhost" || requestUrl.hostname === "127.0.0.1") &&
      (originUrl.hostname === "localhost" || originUrl.hostname === "127.0.0.1") &&
      (originUrl.port === "3000" || originUrl.port === "3001");

    return isLocalDev ? origin : null;
  } catch {
    return null;
  }
}

function corsHeaders(request: Request, env: Env) {
  const allowedOrigin = getAllowedOrigin(request, env);

  if (!allowedOrigin) return null;

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function json(request: Request, env: Env, data: unknown, status = 200) {
  const headers = corsHeaders(request, env);

  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...(headers ?? {}),
    },
  });
}

function getAppUrl(request: Request, env: Env) {
  const origin = request.headers.get("Origin");

  if (origin) {
    const url = new URL(origin);

    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      return origin.replace(/\/+$/, "");
    }
  }

  return env.APP_URL.replace(/\/+$/, "");
}

function getManageUrl(request: Request, env: Env, slug: string, deleteToken: string) {
  return `${getAppUrl(request, env)}/d/${slug}?delete_token=${encodeURIComponent(
    deleteToken
  )}`;
}

async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);

  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function writeUint16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

function writeUint32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value >>> 0, true);
}

function concatBytes(...parts: Uint8Array[]) {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;

  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }

  return output;
}

function getDosDateTime(date = new Date()) {
  const year = Math.max(date.getFullYear(), 1980);

  return {
    modifiedTime:
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      Math.floor(date.getSeconds() / 2),
    modifiedDate:
      ((year - 1980) << 9) |
      ((date.getMonth() + 1) << 5) |
      date.getDate(),
  };
}

function updateCrc32(crc: number, chunk: Uint8Array) {
  let nextCrc = crc;

  for (const byte of chunk) {
    nextCrc = crc32Table[(nextCrc ^ byte) & 0xff] ^ (nextCrc >>> 8);
  }

  return nextCrc >>> 0;
}

function sanitizeZipName(name: string) {
  const sanitized = name
    .replace(/[\\/]+/g, "_")
    .replace(/[\u0000-\u001f]+/g, "_")
    .trim();

  return sanitized || "fichier";
}

function uniqueZipNames(files: ZipFile[]) {
  const seen = new Map<string, number>();

  return files.map((file) => {
    const name = sanitizeZipName(file.original_name);
    const count = seen.get(name) ?? 0;
    seen.set(name, count + 1);

    if (count === 0) return name;

    const dotIndex = name.lastIndexOf(".");

    if (dotIndex > 0) {
      return `${name.slice(0, dotIndex)}-${count + 1}${name.slice(dotIndex)}`;
    }

    return `${name}-${count + 1}`;
  });
}

function createLocalFileHeader(entry: ZipCentralEntry) {
  const header = new Uint8Array(30);
  const view = new DataView(header.buffer);

  writeUint32(view, 0, 0x04034b50);
  writeUint16(view, 4, 20);
  writeUint16(view, 6, 0x0808);
  writeUint16(view, 8, 0);
  writeUint16(view, 10, entry.modifiedTime);
  writeUint16(view, 12, entry.modifiedDate);
  writeUint16(view, 26, entry.name.length);

  return concatBytes(header, entry.name);
}

function createDataDescriptor(entry: ZipCentralEntry) {
  const descriptor = new Uint8Array(16);
  const view = new DataView(descriptor.buffer);

  writeUint32(view, 0, 0x08074b50);
  writeUint32(view, 4, entry.crc32);
  writeUint32(view, 8, entry.compressedSize);
  writeUint32(view, 12, entry.uncompressedSize);

  return descriptor;
}

function createCentralDirectoryHeader(entry: ZipCentralEntry) {
  const header = new Uint8Array(46);
  const view = new DataView(header.buffer);

  writeUint32(view, 0, 0x02014b50);
  writeUint16(view, 4, 20);
  writeUint16(view, 6, 20);
  writeUint16(view, 8, 0x0808);
  writeUint16(view, 10, 0);
  writeUint16(view, 12, entry.modifiedTime);
  writeUint16(view, 14, entry.modifiedDate);
  writeUint32(view, 16, entry.crc32);
  writeUint32(view, 20, entry.compressedSize);
  writeUint32(view, 24, entry.uncompressedSize);
  writeUint16(view, 28, entry.name.length);
  writeUint32(view, 42, entry.offset);

  return concatBytes(header, entry.name);
}

function createEndOfCentralDirectory(
  entryCount: number,
  centralDirectorySize: number,
  centralDirectoryOffset: number
) {
  const record = new Uint8Array(22);
  const view = new DataView(record.buffer);

  writeUint32(view, 0, 0x06054b50);
  writeUint16(view, 8, entryCount);
  writeUint16(view, 10, entryCount);
  writeUint32(view, 12, centralDirectorySize);
  writeUint32(view, 16, centralDirectoryOffset);

  return record;
}

async function* createZipChunks(env: Env, files: ZipFile[]) {
  const centralEntries: ZipCentralEntry[] = [];
  const names = uniqueZipNames(files);
  let offset = 0;

  for (let index = 0; index < files.length; index++) {
    const object = await env.FILES_BUCKET.get(files[index].r2_key);

    if (!object?.body) {
      console.log(
        JSON.stringify({
          event: "r2-object-missing-in-zip",
          r2Key: files[index].r2_key,
        })
      );
      throw new Error("file-unavailable");
    }

    const { modifiedTime, modifiedDate } = getDosDateTime();
    const entry: ZipCentralEntry = {
      name: textEncoder.encode(names[index]),
      crc32: 0,
      compressedSize: 0,
      uncompressedSize: 0,
      offset,
      modifiedTime,
      modifiedDate,
    };
    const localHeader = createLocalFileHeader(entry);

    offset += localHeader.length;
    yield localHeader;

    let crc = 0xffffffff;
    const reader = object.body.getReader();

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      crc = updateCrc32(crc, value);
      entry.compressedSize += value.length;
      entry.uncompressedSize += value.length;
      offset += value.length;
      yield value;
    }

    entry.crc32 = (crc ^ 0xffffffff) >>> 0;

    const descriptor = createDataDescriptor(entry);
    offset += descriptor.length;
    yield descriptor;

    centralEntries.push(entry);
  }

  const centralDirectoryOffset = offset;

  for (const entry of centralEntries) {
    const header = createCentralDirectoryHeader(entry);
    offset += header.length;
    yield header;
  }

  yield createEndOfCentralDirectory(
    centralEntries.length,
    offset - centralDirectoryOffset,
    centralDirectoryOffset
  );
}

function createZipStream(env: Env, files: ZipFile[]) {
  const iterator = createZipChunks(env, files);

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await iterator.next();

        if (done) {
          controller.close();
          return;
        }

        controller.enqueue(value);
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

async function cleanupExpiredTransfers(
  env: Env,
  now = new Date(),
  transferLimit = 50
): Promise<CleanupResult> {
  const expiredTransfers = await env.DB.prepare(
    `SELECT id
     FROM transfers
     WHERE expires_at <= ?
     ORDER BY expires_at ASC
     LIMIT ?`
  )
    .bind(now.toISOString(), transferLimit)
    .all<{ id: string }>();

  let deletedTransfers = 0;
  let deletedFiles = 0;

  for (const transfer of expiredTransfers.results) {
    const result = await deleteTransferById(env, transfer.id);
    deletedTransfers += 1;
    deletedFiles += result.deletedFiles;
  }

  return {
    checkedTransfers: expiredTransfers.results.length,
    deletedTransfers,
    deletedFiles,
  };
}

async function deleteTransferById(env: Env, transferId: string) {
  const files = await env.DB.prepare(
    `SELECT r2_key
     FROM files
     WHERE transfer_id = ?`
  )
    .bind(transferId)
    .all<{ r2_key: string }>();

  const r2Keys = files.results.map((file) => file.r2_key);

  for (const keys of chunk(r2Keys, 1000)) {
    if (keys.length > 0) {
      await env.FILES_BUCKET.delete(keys);
    }
  }

  await env.DB.batch([
    env.DB.prepare("DELETE FROM files WHERE transfer_id = ?").bind(transferId),
    env.DB.prepare("DELETE FROM transfers WHERE id = ?").bind(transferId),
  ]);

  return {
    deletedFiles: r2Keys.length,
  };
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      const headers = corsHeaders(request, env);

      if (!headers) {
        return new Response(null, { status: 403 });
      }

      return new Response(null, {
        status: 204,
        headers,
      });
    }

    if (request.headers.get("Origin") && !corsHeaders(request, env)) {
      return new Response(JSON.stringify({ error: "Origine non autorisée." }), {
        status: 403,
        headers: {
          "Content-Type": "application/json",
          "Vary": "Origin",
        },
      });
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return json(request, env, { ok: true });
    }

    if (request.method === "POST" && url.pathname === "/transfers") {
      const body = await request.json<{
        title?: string;
        message?: string;
        password?: string;
        expiresInDays?: number;
        files: {
          name: string;
          size: number;
          type?: string;
        }[];
      }>();

      if (!body.files?.length) {
        return json(request, env, { error: "Aucun fichier fourni." }, 400);
      }

      if (body.files.length > MAX_FILE_COUNT) {
        return json(request, env, 
          { error: `Maximum ${MAX_FILE_COUNT} fichiers par transfert.` },
          400
        );
      }

      if (
        body.files.some(
          (file) => !Number.isFinite(file.size) || file.size <= 0
        )
      ) {
        return json(request, env, { error: "Taille de fichier invalide." }, 400);
      }

      if (body.files.some((file) => file.size > MAX_FILE_SIZE)) {
        return json(
          request,
          env,
          { error: "Taille maximale par fichier dépassée." },
          400
        );
      }

      const totalSize = body.files.reduce((sum, file) => sum + file.size, 0);

      if (totalSize > MAX_TOTAL_SIZE) {
        return json(request, env, { error: "Taille maximale du transfert dépassée." }, 400);
      }

      const requestedExpiresInDays = body.expiresInDays ?? 7;

      if (
        !Number.isFinite(requestedExpiresInDays) ||
        requestedExpiresInDays < 1 ||
        requestedExpiresInDays > MAX_EXPIRATION_DAYS
      ) {
        return json(request, env, 
          { error: `Durée maximale : ${MAX_EXPIRATION_DAYS} jours.` },
          400
        );
      }

      const transferId = nanoid();
      const slug = nanoid(12);
      const now = new Date();
      const expiresInDays = requestedExpiresInDays;
      const expiresAt = new Date(
        now.getTime() + expiresInDays * 24 * 60 * 60 * 1000
      );

      const passwordHash = body.password ? await sha256(body.password) : null;
      const title = body.title?.trim()
        ? body.title.trim().slice(0, MAX_TRANSFER_TITLE_LENGTH)
        : null;
      const message = body.message?.trim()
        ? body.message.trim().slice(0, MAX_TRANSFER_MESSAGE_LENGTH)
        : null;
      const deleteToken = nanoid(48);
      const deleteTokenHash = await sha256(deleteToken);

      await env.DB.prepare(
        `INSERT INTO transfers 
        (id, slug, title, message, password_hash, delete_token_hash, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          transferId,
          slug,
          title,
          message,
          passwordHash,
          deleteTokenHash,
          expiresAt.toISOString(),
          now.toISOString()
        )
        .run();

      const uploadFiles = [];

      for (const file of body.files) {
        const fileId = nanoid();
        const safeName = file.name.replace(/[^\w.\-() ]+/g, "_");
        const r2Key = `${transferId}/${fileId}-${safeName}`;

        await env.DB.prepare(
          `INSERT INTO files 
          (id, transfer_id, original_name, r2_key, size, mime_type, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            fileId,
            transferId,
            file.name,
            r2Key,
            file.size,
            file.type ?? null,
            now.toISOString()
          )
          .run();

        uploadFiles.push({
          id: fileId,
          name: file.name,
          r2Key,
          uploadUrl: `${url.origin}/upload/${fileId}`,
        });
      }

      return json(request, env, {
        slug,
        downloadUrl: `${getAppUrl(request, env)}/d/${slug}`,
        manageUrl: getManageUrl(request, env, slug, deleteToken),
        files: uploadFiles,
      });
    }

    if (request.method === "PUT" && url.pathname.startsWith("/upload/")) {
      const fileId = url.pathname.replace("/upload/", "");

      const file = await env.DB.prepare(
        `SELECT r2_key, mime_type, size, upload_status FROM files WHERE id = ?`
      )
        .bind(fileId)
        .first<{
          r2_key: string;
          mime_type: string | null;
          size: number;
          upload_status: string;
        }>();

      if (!file) {
        return json(request, env, { error: "Fichier indisponible." }, 404);
      }

      const contentLengthHeader = request.headers.get("Content-Length");

      if (!contentLengthHeader) {
        return json(request, env, { error: "Content-Length obligatoire." }, 411);
      }

      const contentLength = Number(contentLengthHeader);

      if (!Number.isFinite(contentLength) || contentLength !== file.size) {
        return json(request, env, { error: "Taille du fichier supérieure à la limite déclarée." }, 413);
      }

      if (file.size > MAX_FILE_SIZE) {
        return json(request, env, { error: "Taille maximale par fichier dépassée." }, 413);
      }

      if (!request.body) {
        return json(request, env, { error: "Corps de fichier manquant." }, 400);
      }

      await env.FILES_BUCKET.put(file.r2_key, request.body, {
        httpMetadata: {
          contentType: file.mime_type ?? "application/octet-stream",
        },
      });

      await env.DB.prepare(
        `UPDATE files
         SET upload_status = 'uploaded', uploaded_at = ?
         WHERE id = ?`
      )
        .bind(new Date().toISOString(), fileId)
        .run();

      return json(request, env, { ok: true });
    }

    if (request.method === "DELETE" && url.pathname.startsWith("/transfers/")) {
      const slug = url.pathname.replace("/transfers/", "");
      const body = (await request.json().catch(() => null)) as {
        deleteToken?: string;
        delete_token?: string;
      } | null;
      const deleteToken =
        body?.deleteToken || body?.delete_token || url.searchParams.get("delete_token");

      if (!deleteToken) {
        return json(request, env, { error: "Suppression non autorisée." }, 401);
      }

      const deleteTokenHash = await sha256(deleteToken);
      const transfer = await env.DB.prepare(
        `SELECT id
         FROM transfers
         WHERE slug = ? AND delete_token_hash = ?`
      )
        .bind(slug, deleteTokenHash)
        .first<{ id: string }>();

      if (!transfer) {
        return json(request, env, { error: "Suppression non autorisée." }, 404);
      }

      const result = await deleteTransferById(env, transfer.id);

      console.log(
        JSON.stringify({
          event: "transfer-deleted",
          slug,
          deletedFiles: result.deletedFiles,
        })
      );

      return json(request, env, { ok: true });
    }

    if (request.method === "GET" && url.pathname.startsWith("/transfers/")) {
      const slug = url.pathname.replace("/transfers/", "");

      const transfer = await env.DB.prepare(
        `SELECT id, slug, title, message, password_hash, expires_at, created_at
         FROM transfers
         WHERE slug = ?`
      )
        .bind(slug)
        .first<{
          id: string;
          slug: string;
          title: string | null;
          message: string | null;
          password_hash: string | null;
          expires_at: string;
          created_at: string;
        }>();

      if (!transfer) {
        return json(request, env, { error: "Transfert indisponible." }, 404);
      }

      if (new Date(transfer.expires_at) < new Date()) {
        return json(request, env, { error: "Transfert expiré." }, 410);
      }

      const files = await env.DB.prepare(
        `SELECT id, original_name, size, mime_type
         FROM files
         WHERE transfer_id = ? AND upload_status = 'uploaded'
         ORDER BY created_at ASC`
      )
        .bind(transfer.id)
        .all();

      return json(request, env, {
        slug: transfer.slug,
        title: transfer.title,
        message: transfer.message,
        protected: Boolean(transfer.password_hash),
        expiresAt: transfer.expires_at,
        files: files.results,
      });
    }

    if (request.method === "POST" && url.pathname.startsWith("/download-transfer/")) {
      const slug = url.pathname.replace("/download-transfer/", "");
      const body = await request.json<{ password?: string }>();

      const transfer = await env.DB.prepare(
        `SELECT id, slug, title, password_hash, expires_at
         FROM transfers
         WHERE slug = ?`
      )
        .bind(slug)
        .first<{
          id: string;
          slug: string;
          title: string | null;
          message: string | null;
          password_hash: string | null;
          expires_at: string;
        }>();

      if (!transfer) {
        return json(request, env, { error: "Transfert indisponible." }, 404);
      }

      if (new Date(transfer.expires_at) < new Date()) {
        return json(request, env, { error: "Transfert expiré." }, 410);
      }

      if (transfer.password_hash) {
        const givenHash = body.password ? await sha256(body.password) : "";

        if (givenHash !== transfer.password_hash) {
          return json(request, env, { error: "Mot de passe incorrect." }, 401);
        }
      }

      const files = await env.DB.prepare(
        `SELECT r2_key, original_name, size
         FROM files
         WHERE transfer_id = ? AND upload_status = 'uploaded'
         ORDER BY created_at ASC`
      )
        .bind(transfer.id)
        .all<ZipFile>();

      if (!files.results.length) {
        return json(request, env, { error: "Fichier indisponible." }, 404);
      }

      const zipName = sanitizeZipName(transfer.title || `fastdrop-${transfer.slug}`);

      return new Response(createZipStream(env, files.results), {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
            `${zipName}.zip`
          )}`,
          ...(corsHeaders(request, env) ?? {}),
        },
      });
    }

    if (request.method === "POST" && url.pathname.startsWith("/download/")) {
      const fileId = url.pathname.replace("/download/", "");
      const body = await request.json<{ password?: string }>();

      const row = await env.DB.prepare(
        `SELECT 
          f.r2_key,
          f.original_name,
          t.password_hash,
          t.expires_at
        FROM files f
        JOIN transfers t ON t.id = f.transfer_id
        WHERE f.id = ? AND f.upload_status = 'uploaded'`
      )
        .bind(fileId)
        .first<{
          r2_key: string;
          original_name: string;
          password_hash: string | null;
          expires_at: string;
        }>();

      if (!row) {
        return json(request, env, { error: "Fichier indisponible." }, 404);
      }

      if (new Date(row.expires_at) < new Date()) {
        return json(request, env, { error: "Transfert expiré." }, 410);
      }

      if (row.password_hash) {
        const givenHash = body.password ? await sha256(body.password) : "";

        if (givenHash !== row.password_hash) {
          return json(request, env, { error: "Mot de passe incorrect." }, 401);
        }
      }

      const object = await env.FILES_BUCKET.get(row.r2_key);

      if (!object) {
        console.log(
          JSON.stringify({
            event: "r2-object-missing",
            r2Key: row.r2_key,
          })
        );
        return json(request, env, { error: "Fichier indisponible." }, 404);
      }

      return new Response(object.body, {
        headers: {
          "Content-Type":
            object.httpMetadata?.contentType ?? "application/octet-stream",
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
            row.original_name
          )}`,
          ...(corsHeaders(request, env) ?? {}),
        },
      });
    }

    return json(request, env, { error: "Route inconnue." }, 404);
  },

  async scheduled(controller: ScheduledController, env: Env) {
    const result = await cleanupExpiredTransfers(env);

    console.log(
      JSON.stringify({
        event: "expired-transfers-cleanup",
        cron: controller.cron,
        ...result,
      })
    );
  },
} satisfies ExportedHandler<Env>;
