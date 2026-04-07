#!/usr/bin/env node
/* eslint-disable */
/**
 * Codi Deck - Live preview server
 * Usage: node server.js --port 3131 --file deck.html
 *
 * Serves deck.html with auto-reload on file change via WebSocket.
 */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ========== CLI Args ==========

const args = process.argv.slice(2);
let port = 3131;
let filePath = "deck.html";

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--port" && args[i + 1]) port = parseInt(args[i + 1], 10);
  if (args[i] === "--file" && args[i + 1]) filePath = args[i + 1];
}

const absFilePath = path.resolve(filePath);

// ========== WebSocket (RFC 6455, text frames only) ==========

const WS_MAGIC = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const clients = new Set();

function wsAccept(key) {
  return crypto
    .createHash("sha1")
    .update(key + WS_MAGIC)
    .digest("base64");
}

function wsEncode(payload) {
  const data = Buffer.from(JSON.stringify(payload));
  const header = Buffer.alloc(2);
  header[0] = 0x81; // FIN + text opcode
  header[1] = data.length;
  return Buffer.concat([header, data]);
}

function handleUpgrade(req, socket) {
  const key = req.headers["sec-websocket-key"];
  if (!key) {
    socket.destroy();
    return;
  }
  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\nConnection: Upgrade\r\n" +
      "Sec-WebSocket-Accept: " +
      wsAccept(key) +
      "\r\n\r\n",
  );
  clients.add(socket);
  socket.on("close", function () {
    clients.delete(socket);
  });
  socket.on("error", function () {
    clients.delete(socket);
  });
}

function broadcast(msg) {
  const frame = wsEncode(msg);
  for (const socket of clients) {
    try {
      socket.write(frame);
    } catch (_) {
      clients.delete(socket);
    }
  }
}

// ========== Reload Script ==========

const RELOAD_SCRIPT =
  "<script>\n" +
  "(function(){\n" +
  '  var ws=new WebSocket("ws://"+location.host);\n' +
  '  ws.onmessage=function(e){var d=JSON.parse(e.data);if(d.type==="reload")location.reload();};\n' +
  "  ws.onclose=function(){setTimeout(function(){location.reload();},2000);};\n" +
  "})();\n" +
  "</script>";

// ========== HTTP Handler ==========

function serveFile(req, res) {
  if (!fs.existsSync(absFilePath)) {
    const waiting =
      '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Codi Deck</title>' +
      "<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;" +
      "height:100vh;margin:0;background:#0f0f0f;color:rgba(255,255,255,.5);font-size:18px;}</style>" +
      "</head><body><p>Waiting for deck.html&hellip;</p>" +
      RELOAD_SCRIPT +
      "</body></html>";
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(waiting);
    return;
  }
  let html = fs.readFileSync(absFilePath, "utf-8");
  html = html.includes("</body>")
    ? html.replace("</body>", RELOAD_SCRIPT + "\n</body>")
    : html + RELOAD_SCRIPT;
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

// ========== File Watcher ==========

let debounceTimer = null;

function startWatch() {
  const dir = path.dirname(absFilePath);
  const filename = path.basename(absFilePath);
  if (!fs.existsSync(dir)) return;
  fs.watch(dir, function (eventType, changedFile) {
    if (changedFile !== filename) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      debounceTimer = null;
      broadcast({ type: "reload" });
    }, 120);
  });
}

// ========== Server Startup ==========

const server = http.createServer(serveFile);
server.on("upgrade", handleUpgrade);

server.listen(port, "127.0.0.1", function () {
  console.log("Deck server: http://localhost:" + port);
  console.log("Watching:    " + absFilePath);
});

startWatch();

process.on("SIGTERM", function () {
  server.close(function () {
    process.exit(0);
  });
});
process.on("SIGINT", function () {
  server.close(function () {
    process.exit(0);
  });
});
