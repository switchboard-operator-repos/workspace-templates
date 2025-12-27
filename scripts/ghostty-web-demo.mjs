import http from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { spawn } from "@lydell/node-pty";
import { WebSocketServer } from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = process.env.WORKSPACE_ROOT
  ? path.resolve(process.env.WORKSPACE_ROOT)
  : path.resolve(__dirname, "..");
const ghosttyRoot = path.join(workspaceRoot, "node_modules", "ghostty-web");
const ghosttyDist = path.join(ghosttyRoot, "dist");
const ghosttyWasm = path.join(ghosttyRoot, "ghostty-vt.wasm");
const port = Number(process.env.PORT ?? 8083);

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Ghostty Web</title>
    <style>
      html,
      body {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        background: #303446;
      }
      #terminal {
        width: 100%;
        height: 100%;
        background: #303446;
      }
    </style>
  </head>
  <body>
    <div id="terminal"></div>
    <script type="module">
      import { init, Terminal, FitAddon } from "/dist/ghostty-web.js";

      const params = new URLSearchParams(window.location.search);
      const pm2Target = params.get("pm2");
      const container = document.getElementById("terminal");

      await init();

      const term = new Terminal({
        cols: 80,
        rows: 24,
        fontFamily: "JetBrains Mono, Menlo, Monaco, monospace",
        fontSize: 14,
        theme: {
          background: "#303446",
          foreground: "#c6d0f5",
          cursor: "#f2d5cf",
          selectionBackground: "#414559",
        },
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(container);
      fitAddon.fit();
      term.focus();

      const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(
        wsProtocol + "://" + window.location.host + "/ws"
      );

      const sendResize = () => {
        const dims = fitAddon.proposeDimensions?.();
        if (!dims) {
          return;
        }
        term.resize(dims.cols, dims.rows);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "resize", cols: dims.cols, rows: dims.rows }));
        }
      };

      const resizeObserver = new ResizeObserver(() => {
        fitAddon.fit();
        sendResize();
      });
      resizeObserver.observe(container);

      window.addEventListener("resize", () => {
        fitAddon.fit();
        sendResize();
      });

      if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", () => {
          fitAddon.fit();
          sendResize();
        });
      }

      term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });

      ws.addEventListener("message", (event) => {
        if (typeof event.data === "string") {
          term.write(event.data);
        } else {
          const decoder = new TextDecoder();
          term.write(decoder.decode(event.data));
        }
      });

      ws.addEventListener("open", () => {
        sendResize();
        if (pm2Target) {
          ws.send("pm2 logs " + pm2Target + " --lines 200\\n");
        }
      });
    </script>
  </body>
</html>`;

function contentTypeForPath(filePath) {
  if (filePath.endsWith(".js")) {
    return "application/javascript; charset=utf-8";
  }
  if (filePath.endsWith(".wasm")) {
    return "application/wasm";
  }
  if (filePath.endsWith(".html")) {
    return "text/html; charset=utf-8";
  }
  return "application/octet-stream";
}

async function serveFile(res, filePath) {
  try {
    await stat(filePath);
  } catch (error) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  res.writeHead(200, { "Content-Type": contentTypeForPath(filePath) });
  createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const pathname = url.pathname;

  if (pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }

  if (pathname === "/ghostty-vt.wasm") {
    await serveFile(res, ghosttyWasm);
    return;
  }

  if (pathname.startsWith("/dist/")) {
    const relative = pathname.slice("/dist/".length);
    if (relative.includes("..")) {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Invalid path");
      return;
    }
    const filePath = path.join(ghosttyDist, relative);
    await serveFile(res, filePath);
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not found");
});

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (socket) => {
  const shell = process.env.SHELL ?? "/bin/bash";
  const ptyProcess = spawn(shell, [], {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
    cwd: workspaceRoot,
    env: {
      ...process.env,
      TERM: "xterm-256color",
      COLORTERM: "truecolor",
    },
  });

  ptyProcess.onData((data) => {
    if (socket.readyState === socket.OPEN) {
      socket.send(data);
    }
  });

  socket.on("message", (raw) => {
    const message = raw.toString();
    if (message.startsWith("{")) {
      try {
        const payload = JSON.parse(message);
        if (payload.type === "resize") {
          const cols = Number(payload.cols);
          const rows = Number(payload.rows);
          if (Number.isFinite(cols) && Number.isFinite(rows)) {
            ptyProcess.resize(cols, rows);
          }
          return;
        }
      } catch {
        // Fall through to treat as raw input.
      }
    }
    ptyProcess.write(message);
  });

  const cleanup = () => {
    try {
      ptyProcess.kill();
    } catch {
      // Ignore teardown errors.
    }
  };

  socket.on("close", cleanup);
  socket.on("error", cleanup);
});

server.listen(port, () => {
  console.log(`[ghostty] listening on ${port}`);
});
