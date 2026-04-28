# Fathom Proxy Patch for src/server.js

**Repo file:** `src/server.js` in your Railway template project (the one with the Express/HTTP-proxy wrapper).

**Insert** the following block after the AOF webhook proxy (after line 357, the `});` ending the `/webhook` POST handler). Just before `app.get("/setup/app.js", ...)`.

```js
// ── Fathom webhook proxy routes ──────────────────────────────────────
// Proxies /api/fathom/* to the internal Fathom webhook server on port 4242.

app.post("/api/fathom/webhook", (req, res) => {
  const options = {
    hostname: "127.0.0.1",
    port: 4242,
    path: "/fathom/webhook",
    method: "POST",
    headers: req.headers,
  };
  const proxyReq = http.request(options, (proxyRes) => {
    res.statusCode = proxyRes.statusCode;
    proxyRes.pipe(res);
  });
  proxyReq.on("error", (err) => {
    console.error("[Fathom Proxy] Error:", err.message);
    res.status(502).json({ error: "Webhook server unavailable" });
  });
  req.pipe(proxyReq);
});

app.get("/api/fathom/health", (_req, res) => {
  const options = {
    hostname: "127.0.0.1",
    port: 4242,
    path: "/health",
    method: "GET",
  };
  const proxyReq = http.request(options, (proxyRes) => {
    res.statusCode = proxyRes.statusCode;
    proxyRes.pipe(res);
  });
  proxyReq.on("error", () => {
    res.status(502).json({ status: "down" });
  });
  proxyReq.end();
});

app.post("/api/fathom/assign", (req, res) => {
  const options = {
    hostname: "127.0.0.1",
    port: 4242,
    path: "/assign",
    method: "POST",
    headers: req.headers,
  };
  const proxyReq = http.request(options, (proxyRes) => {
    res.statusCode = proxyRes.statusCode;
    proxyRes.pipe(res);
  });
  proxyReq.on("error", (err) => {
    console.error("[Fathom Assign] Error:", err.message);
    res.status(502).json({ error: "Webhook server unavailable" });
  });
  req.pipe(proxyReq);
});
```

The `http` module is already imported at the top of `server.js` (as `import { createServer } from "node:http"` or similar), so no additional imports needed.

After adding, commit, push, deploy. The webhook server (port 4242) is currently running and healthy inside the container, waiting for Fathom to connect.
