const http = require('http');
const fs   = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;

// Simpan data terakhir dari ESP32
let latestData = null;
let lastSeen   = null;

// ─── HTTP Server ──────────────────────────────────────────────
const httpServer = http.createServer((req, res) => {

  // ESP32 POST data ke /data
  if (req.method === 'POST' && req.url === '/data') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        latestData = JSON.parse(body);
        lastSeen   = new Date().toISOString();
        // Broadcast ke semua dashboard yang terbuka
        wss.clients.forEach(client => {
          if (client.readyState === 1) {
            client.send(JSON.stringify(latestData));
          }
        });
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OK');
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Bad JSON');
      }
    });
    return;
  }

  // Status endpoint
  if (req.method === 'GET' && req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      online: latestData !== null,
      lastSeen,
      clients: wss.clients.size
    }));
    return;
  }

  // Serve dashboard HTML
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    const filePath = path.join(__dirname, 'public', 'index.html');
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404); res.end('Not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  res.writeHead(404); res.end('Not found');
});

// ─── WebSocket Server ─────────────────────────────────────────
const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws) => {
  console.log('[WS] Dashboard terhubung. Total:', wss.clients.size);

  // Kirim data terakhir langsung ke client baru
  if (latestData) {
    ws.send(JSON.stringify(latestData));
  }

  ws.on('close', () => {
    console.log('[WS] Dashboard terputus. Sisa:', wss.clients.size);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server jalan di port ${PORT}`);
});
