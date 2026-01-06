const http = require("node:http");

const port = Number.parseInt(process.env.PORT ?? "8787", 10);
const server = http.createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/plain" });
  res.end(`hello from operator (pid ${process.pid})\n`);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`hello server listening on ${port}`);
});
