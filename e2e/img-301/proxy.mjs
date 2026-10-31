import http from "node:http";
import net from "node:net";

const server = http.createServer((req, res) => {
  const api = req.url?.startsWith("/api/") && !req.url.startsWith("/api/auth/");
  const upstream = http.request({
    hostname: "127.0.0.1",
    port: Number(api ? process.env.IMG301_API_PORT : process.env.IMG301_NEXT_PORT),
    path: req.url,
    method: req.method,
    headers: req.headers
  }, response => {
    res.writeHead(response.statusCode ?? 502, response.headers);
    response.pipe(res);
  });
  upstream.on("error", () => { if (!res.headersSent) res.writeHead(502); res.end(); });
  req.pipe(upstream);
});
server.on("upgrade", (req, socket, head) => {
  const upstream = net.connect(Number(process.env.IMG301_NEXT_PORT), "127.0.0.1", () => {
    upstream.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`);
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      upstream.write(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}\r\n`);
    }
    upstream.write("\r\n");
    if (head.length) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
});
server.listen(Number(process.env.IMG301_PROXY_PORT), "127.0.0.1");
import process from "node:process";
