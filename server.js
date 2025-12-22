/**
 * Stealth Proxy Service
 * Anti-bot bypass using Node.js with browser-like headers
 * Replaces Playwright for lighter, faster scraping
 */

const express = require("express");
const http = require("http");
const https = require("https");
const url = require("url");
const zlib = require("zlib");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;

// Realistic browser user agents
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
];

// Generate stealth headers
function getStealthHeaders(targetUrl) {
  const parsed = url.parse(targetUrl);
  const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

  return {
    "User-Agent": userAgent,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "Sec-Ch-Ua":
      '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    Referer: `${parsed.protocol}//${parsed.host}/`,
    Origin: `${parsed.protocol}//${parsed.host}`,
    DNT: "1",
    Connection: "keep-alive",
  };
}

// Decompress response based on encoding
function decompressResponse(buffer, encoding) {
  return new Promise((resolve, reject) => {
    if (!encoding) {
      resolve(buffer);
      return;
    }

    switch (encoding.toLowerCase()) {
      case "gzip":
        zlib.gunzip(buffer, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
        break;
      case "deflate":
        zlib.inflate(buffer, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
        break;
      case "br":
        zlib.brotliDecompress(buffer, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
        break;
      default:
        resolve(buffer);
    }
  });
}

// Fetch URL with stealth headers
function fetchWithStealth(targetUrl, timeout = 15000) {
  return new Promise((resolve, reject) => {
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
      rejectUnauthorized: false, // Accept self-signed certs
    };

    const req = client.request(options, (res) => {
      const chunks = [];

      // Handle redirects
      if (
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        const redirectUrl = res.headers.location.startsWith("http")
          ? res.headers.location
          : url.resolve(targetUrl, res.headers.location);

        console.log(`[PROXY] Redirecting to: ${redirectUrl}`);
        fetchWithStealth(redirectUrl, timeout).then(resolve).catch(reject);
        return;
      }

      res.on("data", (chunk) => chunks.push(chunk));

      res.on("end", async () => {
        try {
          const buffer = Buffer.concat(chunks);
          const encoding = res.headers["content-encoding"];
          const decompressed = await decompressResponse(buffer, encoding);

          const contentType = res.headers["content-type"] || "";
          const isText =
            contentType.includes("text") ||
            contentType.includes("json") ||
            contentType.includes("javascript");

          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: decompressed,
            html: isText ? decompressed.toString("utf-8") : null,
            isBinary: !isText,
          });
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });

    req.end();
  });
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "stealth-proxy" });
});

// Main fetch endpoint
app.post("/fetch", async (req, res) => {
  const { url: targetUrl, timeout = 15000 } = req.body;

  if (!targetUrl) {
    return res.status(400).json({ error: "URL is required" });
  }

  console.log(`[PROXY] Fetching: ${targetUrl}`);

  try {
    const result = await fetchWithStealth(targetUrl, timeout);
    console.log(`[PROXY] Success: ${targetUrl} - Status: ${result.status}`);
    res.json(result);
  } catch (error) {
    console.error(`[PROXY] Error fetching ${targetUrl}:`, error.message);
    res.status(500).json({
      error: error.message,
      status: 0,
    });
  }
});

// Forward proxy endpoint (for direct proxying)
app.get("/proxy", async (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({ error: "URL query parameter is required" });
  }

    try {
        const result = await fetchWithStealth(decodeURIComponent(targetUrl));
        const contentType = result.headers['content-type'] || 'application/octet-stream';
        res.set('Content-Type', contentType);
        res.send(result.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Keep-Alive Mechanism for Render
function startKeepAlive() {
  console.log("⏰ [PROXY] Starting Keep-Alive mechanism...");
  setInterval(() => {
    http.get(`http://localhost:${PORT}/health`, (res) => {
      if (res.statusCode === 200) {
        // console.log("💓 [PROXY] Self-Ping Successful"); // Optional: reduce logs
      } else {
        console.warn(`⚠️ [PROXY] Self-Ping Warning: Status ${res.statusCode}`);
      }
    }).on('error', (err) => {
      console.error(`❌ [PROXY] Keep-Alive Error: ${err.message}`);
    });
  }, 14 * 60 * 1000); // 14 Minutes
}

app.listen(PORT, () => {
  console.log(`[PROXY] Stealth proxy service running on port ${PORT}`);
  startKeepAlive();
});

module.exports = app;
