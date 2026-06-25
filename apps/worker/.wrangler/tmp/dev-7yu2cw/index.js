var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// node_modules/nanoid/url-alphabet/index.js
var urlAlphabet = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";

// node_modules/nanoid/index.browser.js
var nanoid = /* @__PURE__ */ __name((size = 21) => {
  let id = "";
  let bytes = crypto.getRandomValues(new Uint8Array(size |= 0));
  while (size--) {
    id += urlAlphabet[bytes[size] & 63];
  }
  return id;
}, "nanoid");

// src/index.ts
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders
    }
  });
}
__name(json, "json");
async function sha256(value) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(sha256, "sha256");
var src_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true });
    }
    if (request.method === "POST" && url.pathname === "/transfers") {
      const body = await request.json();
      if (!body.files?.length) {
        return json({ error: "Aucun fichier fourni." }, 400);
      }
      const transferId = nanoid();
      const slug = nanoid(12);
      const now = /* @__PURE__ */ new Date();
      const expiresInDays = body.expiresInDays ?? 7;
      const expiresAt = new Date(
        now.getTime() + expiresInDays * 24 * 60 * 60 * 1e3
      );
      const passwordHash = body.password ? await sha256(body.password) : null;
      await env.DB.prepare(
        `INSERT INTO transfers 
        (id, slug, title, password_hash, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(
        transferId,
        slug,
        body.title ?? null,
        passwordHash,
        expiresAt.toISOString(),
        now.toISOString()
      ).run();
      const uploadFiles = [];
      for (const file of body.files) {
        const fileId = nanoid();
        const safeName = file.name.replace(/[^\w.\-() ]+/g, "_");
        const r2Key = `${transferId}/${fileId}-${safeName}`;
        await env.DB.prepare(
          `INSERT INTO files 
          (id, transfer_id, original_name, r2_key, size, mime_type, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          fileId,
          transferId,
          file.name,
          r2Key,
          file.size,
          file.type ?? null,
          now.toISOString()
        ).run();
        uploadFiles.push({
          id: fileId,
          name: file.name,
          r2Key,
          uploadUrl: `${url.origin}/upload/${fileId}`
        });
      }
      return json({
        slug,
        downloadUrl: `${env.APP_URL}/d/${slug}`,
        files: uploadFiles
      });
    }
    if (request.method === "PUT" && url.pathname.startsWith("/upload/")) {
      const fileId = url.pathname.replace("/upload/", "");
      const file = await env.DB.prepare(
        `SELECT r2_key, mime_type FROM files WHERE id = ?`
      ).bind(fileId).first();
      if (!file) {
        return json({ error: "Fichier introuvable." }, 404);
      }
      await env.FILES_BUCKET.put(file.r2_key, request.body, {
        httpMetadata: {
          contentType: file.mime_type ?? "application/octet-stream"
        }
      });
      return json({ ok: true });
    }
    if (request.method === "GET" && url.pathname.startsWith("/transfers/")) {
      const slug = url.pathname.replace("/transfers/", "");
      const transfer = await env.DB.prepare(
        `SELECT id, slug, title, password_hash, expires_at, created_at
         FROM transfers
         WHERE slug = ?`
      ).bind(slug).first();
      if (!transfer) {
        return json({ error: "Transfert introuvable." }, 404);
      }
      if (new Date(transfer.expires_at) < /* @__PURE__ */ new Date()) {
        return json({ error: "Transfert expir\xE9." }, 410);
      }
      const files = await env.DB.prepare(
        `SELECT id, original_name, size, mime_type
         FROM files
         WHERE transfer_id = ?`
      ).bind(transfer.id).all();
      return json({
        slug: transfer.slug,
        title: transfer.title,
        protected: Boolean(transfer.password_hash),
        expiresAt: transfer.expires_at,
        files: files.results
      });
    }
    if (request.method === "POST" && url.pathname.startsWith("/download/")) {
      const fileId = url.pathname.replace("/download/", "");
      const body = await request.json();
      const row = await env.DB.prepare(
        `SELECT 
          f.r2_key,
          f.original_name,
          t.password_hash,
          t.expires_at
        FROM files f
        JOIN transfers t ON t.id = f.transfer_id
        WHERE f.id = ?`
      ).bind(fileId).first();
      if (!row) {
        return json({ error: "Fichier introuvable." }, 404);
      }
      if (new Date(row.expires_at) < /* @__PURE__ */ new Date()) {
        return json({ error: "Transfert expir\xE9." }, 410);
      }
      if (row.password_hash) {
        const givenHash = body.password ? await sha256(body.password) : "";
        if (givenHash !== row.password_hash) {
          return json({ error: "Mot de passe incorrect." }, 401);
        }
      }
      const object = await env.FILES_BUCKET.get(row.r2_key);
      if (!object) {
        return json({ error: "Objet R2 introuvable." }, 404);
      }
      return new Response(object.body, {
        headers: {
          "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
            row.original_name
          )}`,
          ...corsHeaders
        }
      });
    }
    return json({ error: "Route inconnue." }, 404);
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-4ZcMEU/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-4ZcMEU/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
