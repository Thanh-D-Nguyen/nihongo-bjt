import { readFileSync } from "node:fs";
import http from "node:http";
import tls from "node:tls";

// A local HTTPS CONNECT fixture: the Go API still performs real provider HTTP.
const server = http.createServer();
const upstream = http.createServer((req, res) => {
  process.stderr.write(`fixture request ${req.method} ${req.url?.split("?")[0]} host=${req.headers.host}\n`);
  if (req.headers.host !== "api.unsplash.com" || req.headers.authorization !== "Client-ID fixture-key") {
    res.writeHead(403).end();
  } else if (req.url?.startsWith("/search/photos?")) {
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ results: [{
      urls: { regular: "https://images.unsplash.com/fixture-photo" },
      links: { html: "https://unsplash.com/photos/fixture", download_location: "https://api.unsplash.com/photos/fixture/download" },
      user: { name: "Fixture Photographer", links: { html: "https://unsplash.com/@fixture" } }
    }] }));
  } else if (req.url === "/photos/fixture/download") {
    res.writeHead(200, { "content-type": "application/json" }).end("{}");
  } else {
    res.writeHead(404).end();
  }
});
const secure = tls.createServer({ key: readFileSync(process.env.FIXTURE_KEY), cert: readFileSync(process.env.FIXTURE_CERT) }, socket => upstream.emit("connection", socket));
server.on("connect", (req, socket, head) => {
  process.stderr.write(`fixture CONNECT ${req.url}\n`);
  if (req.url !== "api.unsplash.com:443") return socket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
  socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
  if (head.length) socket.unshift(head);
  secure.emit("connection", socket);
});
secure.on("tlsClientError", err => process.stderr.write(`fixture TLS error: ${err.message}\n`));
server.listen(Number(process.env.FIXTURE_PORT), "127.0.0.1");
import process from "node:process";
