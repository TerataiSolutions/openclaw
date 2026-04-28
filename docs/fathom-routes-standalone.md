```js
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
