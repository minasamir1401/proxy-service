/**
 * Stealth Proxy Service - Simplified & Debuggable Version
 * Anti-bot bypass using Node.js with browser-like headers
 */

const express = require("express");
const fetch = require('node-fetch');
const { fetch: undiciFetch } = require('undici');
const url = require('url');
const zlib = require('zlib');
const { AbortController, AbortSignal } = require('abort-controller');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;

console.log(`[Proxy] Initializing on port ${PORT}...`);

// Realistic browser user agents
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Safari/537.36",
];

// Generate advanced stealth headers to bypass anti-bot measures
function getStealthHeaders(targetUrl) {
  const parsed = url.parse(targetUrl);
  const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

  return {
    "User-Agent": userAgent,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Priority": "u=0, i",
    "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    "Connection": "keep-alive",
    "DNT": "1",
    "Referer": `${parsed.protocol}//${parsed.host}/`,
    "Origin": `${parsed.protocol}//${parsed.host}`,
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

// Fetch URL with advanced stealth headers and anti-blocking measures using efficient undici
async function fetchWithStealth(targetUrl, timeout = 20000) {
  try {
    // Use undici which is more efficient than node-fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await undiciFetch(targetUrl, {
      method: 'GET',
      headers: getStealthHeaders(targetUrl),
      signal: controller.signal,
      // Enable connection pooling and keep-alive by default
      dispatcher: undefined, // Use default dispatcher with connection pooling
      // Follow redirects
      redirect: 'follow',
    });
    
    clearTimeout(timeoutId);
    
    const html = await response.text();

    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      html: html,
    };
  } catch (error) {
    console.error(`[Proxy] Fetch error for ${targetUrl}:`, error.message);
    
    // Fallback using node-fetch
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: getStealthHeaders(targetUrl),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      const html = await response.text();

      return {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        html: html,
      };
    } catch (fallbackError) {
      console.error(`[Proxy] Fallback also failed for ${targetUrl}:`, fallbackError.message);
      throw error; // Return original error
    }
  }
}

// Middleware to log every request
app.use((req, res, next) => {
  console.log(`[Proxy] ${req.method} ${req.url}`);
  next();
});

// Main fetch endpoint with retry logic
app.post("/fetch", async (req, res) => {
  const { url: targetUrl, timeout } = req.body;

  if (!targetUrl) {
    console.error("[Proxy] Error: Missing url in request body");
    return res.status(400).json({ error: "Missing url parameter" });
  }

  try {
    console.log(`[Proxy] Fetching: ${targetUrl}`);
    
    // Try multiple times with different approaches
    let result = null;
    let lastError = null;
    
    // First attempt
    try {
      result = await fetchWithStealth(targetUrl, timeout || 20000);
    } catch (error) {
      lastError = error;
      console.warn(`[Proxy] First attempt failed: ${error.message}`);
    }
    
    // If first attempt failed, try with different headers
    if (!result || result.status >= 400) {
      console.log('[Proxy] Trying with different headers...');
      
      // Try with a different user agent and headers
      const altHeaders = {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      };
      
      try {
        result = await fetch(targetUrl, {
          method: 'GET',
          headers: altHeaders,
          timeout: timeout || 20000,
          redirect: 'follow',
          compress: true,
          signal: AbortSignal.timeout(timeout || 20000),
        });
        
        result = {
          status: result.status,
          headers: Object.fromEntries(result.headers.entries()),
          html: await result.text(),
        };
      } catch (error) {
        lastError = error;
        console.warn(`[Proxy] Alternative attempt failed: ${error.message}`);
      }
    }
    
    if (result && result.status < 400 && result.html && result.html.length > 100) {
      console.log(`[Proxy] Success: ${result.status}, ${result.html.length} bytes`);
      
      res.status(200).json({
        status: result.status,
        html: result.html,
        headers: result.headers,
      });
    } else {
      console.error('[Proxy] All attempts failed');
      res.status(500).json({
        error: "Proxy fetch failed after multiple attempts",
        message: lastError ? lastError.message : "Unknown error",
      });
    }
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
