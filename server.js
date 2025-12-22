/**
 * Stealth Proxy Service - Simplified & Debuggable Version
 * Anti-bot bypass using Node.js with browser-like headers
 */

const express = require("express");
const http = require("http");
const https = require("https");
const url = require("url");
const zlib = require("zlib");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;

console.log(`[Proxy] Initializing on port ${PORT}...`);

// Realistic browser user agents
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
];

// Generate stealth headers
function getStealthHeaders(targetUrl) {
  const parsed = url.parse(targetUrl);
  const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

  return {
    "User-Agent": userAgent,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    Referer: `${parsed.protocol}//${parsed.host}/`,
    Origin: `${parsed.protocol}//${parsed.host}`,
  };
}

// Decompress response
async function decompressResponse(buffer, encoding) {
  return new Promise((resolve, reject) => {
    if (!encoding || encoding === "identity") {
      return resolve(buffer);
    }

    let decompressor;
    if (encoding === "gzip") {
      decompressor = zlib.createGunzip();
    } else if (encoding === "deflate") {
      decompressor = zlib.createInflate();
    } else if (encoding === "br") {
      decompressor = zlib.createBrotliDecompress();
    } else {
      return resolve(buffer);
    }

    const chunks = [];
    decompressor.on("data", (chunk) => chunks.push(chunk));
    decompressor.on("end", () => resolve(Buffer.concat(chunks)));
    decompressor.on("error", reject);
    decompressor.write(buffer);
    decompressor.end();
  });
}

// Fetch URL with stealth headers
function fetchWithStealth(targetUrl, timeout = 20000) {
  return new Promise((resolve, reject) => {
    try {
      const parsed = url.parse(targetUrl);
      const isHttps = parsed.protocol === "https:";
      const client = isHttps ? https : http;
      const headers = getStealthHeaders(targetUrl);

      const options = {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.path,
        method: "GET",
        headers: headers,
        timeout: timeout,
        rejectUnauthorized: false,
      };

      const req = client.request(options, (res) => {
        const chunks = [];

        // Handle redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          let redirectUrl = res.headers.location;
          if (!redirectUrl.startsWith("http")) {
            redirectUrl = url.resolve(targetUrl, redirectUrl);
          }
          console.log(`[Proxy] Redirecting: ${targetUrl} -> ${redirectUrl}`);
          if (redirectUrl === targetUrl) {
            return reject(new Error("Infinite redirect loop"));
          }
          fetchWithStealth(redirectUrl, timeout).then(resolve).catch(reject);
          return;
        }

        res.on("data", (chunk) => chunks.push(chunk));

        res.on("end", async () => {
          try {
            const buffer = Buffer.concat(chunks);
            const encoding = res.headers["content-encoding"];
            const decompressed = await decompressResponse(buffer, encoding);

            resolve({
              status: res.statusCode,
              headers: res.headers,
              html: decompressed.toString("utf-8"),
            });
          } catch (err) {
            console.error("[Proxy] Decompression error:", err.message);
            const buffer = Buffer.concat(chunks);
            resolve({
              status: res.statusCode,
              headers: res.headers,
              html: buffer.toString("utf-8"),
            });
          }
        });
      });

      req.on("error", (err) => {
        console.error(`[Proxy] Request Error (${targetUrl}):`, err.message);
        reject(err);
      });

      req.on("timeout", () => {
        req.destroy();
        console.warn(`[Proxy] Timeout (${targetUrl})`);
        reject(new Error("Request timeout"));
      });

      req.end();
    } catch (e) {
      console.error("[Proxy] Critical error in fetchWithStealth:", e.message);
      reject(e);
    }
  });
}

// Middleware to log every request
app.use((req, res, next) => {
  console.log(`[Proxy] ${req.method} ${req.url}`);
  next();
});

// Main fetch endpoint
app.post("/fetch", async (req, res) => {
  const { url: targetUrl, timeout } = req.body;

  if (!targetUrl) {
    console.error("[Proxy] Error: Missing url in request body");
    return res.status(400).json({ error: "Missing url parameter" });
  }

  try {
    console.log(`[Proxy] Fetching: ${targetUrl}`);
    const result = await fetchWithStealth(targetUrl, timeout || 20000);

    console.log(`[Proxy] Success: ${result.status}, ${result.html.length} bytes`);

    res.status(200).json({
      status: result.status,
      html: result.html,
      headers: result.headers,
    });
  } catch (err) {
    console.error("[Proxy] Fetch failed:", err.message);
    res.status(500).json({
      error: "Proxy fetch failed",
      message: err.message,
    });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  console.log("[Proxy] Health check");
  res.json({ status: "ok", timestamp: new Date().toISOString(), port: PORT });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("[Proxy] Unexpected error:", err);
  res.status(500).json({ error: "Unexpected server error" });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`[Proxy] ✅ Server started successfully on port ${PORT}`);
  console.log(`[Proxy] Health check: http://localhost:${PORT}/health`);
});

// Graceful error handling
process.on("uncaughtException", (err) => {
  console.error("[Proxy] ❌ Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[Proxy] ❌ Unhandled Rejection:", reason);
});

// Keep-alive ping (for Render)
setInterval(() => {
  console.log(`[Proxy] Keep-alive ping - ${new Date().toISOString()}`);
}, 5 * 60 * 1000); // Every 5 minutes
