import axios from "axios";
import dotenv from "dotenv";
import { URL } from "url"; // Add this import for URL class

dotenv.config();

const host = process.env.HOST || "127.0.0.1";
const port = process.env.PORT || 8080;
const web_server_url = process.env.PUBLIC_URL || `http://${host}:${port}`;

export default async function proxyM3U8(url, headers, res) {
  if (!url) {
    console.error("No URL provided to proxyM3U8");
    if (!res.headersSent) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Invalid request',
        message: 'No URL provided'
      }));
    }
    return;
  }

  try {
    const req = await axios(url, {
      headers: headers || {}, // Ensure headers is always an object
      timeout: 10000, // Add reasonable timeout
    }).catch((err) => {
      // console.error(`M3U8 proxy error for ${url}:`, err.message);
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'M3U8 proxy request failed',
          message: err.message
        }));
      }
      return null;
    });
    if (!req) {
      return;
    }

    const m3u8 = req.data
      .split("\n")
      .filter((line) => !line.startsWith("#EXT-X-MEDIA:TYPE=AUDIO"))
      .join("\n");
    if (m3u8.includes("RESOLUTION=")) {
      const lines = m3u8.split("\n");
      const newLines = [];
      for (const line of lines) {
        if (line.startsWith("#")) {
          if (line.startsWith("#EXT-X-KEY:")) {
            const regex = /https?:\/\/[^\""\s]+/g;
            const match = regex.exec(line);
            const keyUrl = match ? match[0] : "";
            if (keyUrl) {
              const proxyUrl = `${web_server_url}/ts-proxy?url=${encodeURIComponent(keyUrl)}&headers=${encodeURIComponent(JSON.stringify(headers || {}))}`;
              newLines.push(line.replace(keyUrl, proxyUrl));
            } else {
              newLines.push(line);
            }
          } else {
            newLines.push(line);
          }
        } else if (line.trim()) { // Only process non-empty lines
          try {
            const uri = new URL(line, url);
            newLines.push(
              `${web_server_url}/m3u8-proxy?url=${encodeURIComponent(uri.href)}&headers=${encodeURIComponent(JSON.stringify(headers || {}))}`
            );
          } catch (e) {
            console.error(`Error creating URL from ${line} with base ${url}:`, e.message);
            newLines.push(line); // Keep original line if URL creation fails
          }
        }
      }

      [
        "Access-Control-Allow-Origin",
        "Access-Control-Allow-Methods",
        "Access-Control-Allow-Headers",
        "Access-Control-Max-Age",
        "Access-Control-Allow-Credentials",
        "Access-Control-Expose-Headers",
        "Access-Control-Request-Method",
        "Access-Control-Request-Headers",
        "Origin",
        "Vary",
        "Referer",
        "Server",
        "x-cache",
        "via",
        "x-amz-cf-pop",
        "x-amz-cf-id",
      ].forEach((header) => res.removeHeader(header));

      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Headers", "*");
      res.setHeader("Access-Control-Allow-Methods", "*");

      res.end(newLines.join("\n"));
      return;
    } else {
      const lines = m3u8.split("\n");
      const newLines = [];
      for (const line of lines) {
        if (line.startsWith("#")) {
          if (line.startsWith("#EXT-X-KEY:")) {
            const regex = /https?:\/\/[^\""\s]+/g;
            const match = regex.exec(line);
            const keyUrl = match ? match[0] : "";
            if (keyUrl) {
              const proxyUrl = `${web_server_url}/ts-proxy?url=${encodeURIComponent(keyUrl)}&headers=${encodeURIComponent(JSON.stringify(headers || {}))}`;
              newLines.push(line.replace(keyUrl, proxyUrl));
            } else {
              newLines.push(line);
            }
          } else {
            newLines.push(line);
          }
        } else if (line.trim()) { // Only process non-empty lines
          try {
            const uri = new URL(line, url);
            newLines.push(
              `${web_server_url}/ts-proxy?url=${encodeURIComponent(uri.href)}&headers=${encodeURIComponent(JSON.stringify(headers || {}))}`
            );
          } catch (e) {
            console.error(`Error creating URL from ${line} with base ${url}:`, e.message);
            newLines.push(line); // Keep original line if URL creation fails
          }
        }
      }

      [
        "Access-Control-Allow-Origin",
        "Access-Control-Allow-Methods",
        "Access-Control-Allow-Headers",
        "Access-Control-Max-Age",
        "Access-Control-Allow-Credentials",
        "Access-Control-Expose-Headers",
        "Access-Control-Request-Method",
        "Access-Control-Request-Headers",
        "Origin",
        "Vary",
        "Referer",
        "Server",
        "x-cache",
        "via",
        "x-amz-cf-pop",
        "x-amz-cf-id",
      ].forEach((header) => res.removeHeader(header));

      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Headers", "*");
      res.setHeader("Access-Control-Allow-Methods", "*");

      res.end(newLines.join("\n"));
      return;
    }
  } catch (err) {
    console.error(`Unexpected error in proxyM3U8 for ${url}:`, err.message);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Internal server error in M3U8 proxy',
        message: err.message
      }));
    }
  }
}