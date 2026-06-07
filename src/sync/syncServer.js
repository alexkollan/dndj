'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

let _server = null;
let _token = null;
let _soundsDir = null;
let _dbPath = null;
let _port = 7432;

function getLocalIp() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

function buildManifest(dir, base = '') {
  if (!fs.existsSync(dir)) return [];
  const entries = [];
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) {
      entries.push(...buildManifest(abs, rel));
    } else {
      entries.push({ path: rel, size: stat.size });
    }
  }
  return entries;
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function handleRequest(req, res) {
  const authHeader = req.headers['authorization'] || '';
  if (authHeader !== `Bearer ${_token}`) {
    return sendJson(res, 401, { error: 'Unauthorized' });
  }

  const url = new URL(req.url, `http://localhost:${_port}`);
  const p = url.pathname;

  if (p === '/status') {
    return sendJson(res, 200, { ok: true, version: 1 });
  }

  if (p === '/db') {
    if (!fs.existsSync(_dbPath)) return sendJson(res, 404, { error: 'DB not found' });
    const stat = fs.statSync(_dbPath);
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(stat.size),
    });
    return fs.createReadStream(_dbPath).pipe(res);
  }

  if (p === '/manifest') {
    const files = buildManifest(_soundsDir);
    return sendJson(res, 200, { files });
  }

  if (p === '/file') {
    const relPath = url.searchParams.get('p');
    if (!relPath) return sendJson(res, 400, { error: 'Missing p param' });
    const abs = path.resolve(_soundsDir, relPath);
    if (!abs.startsWith(path.resolve(_soundsDir))) {
      return sendJson(res, 403, { error: 'Forbidden' });
    }
    if (!fs.existsSync(abs)) return sendJson(res, 404, { error: 'File not found' });
    const stat = fs.statSync(abs);
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(stat.size),
    });
    return fs.createReadStream(abs).pipe(res);
  }

  sendJson(res, 404, { error: 'Not found' });
}

function startServer({ token, port = 7432, soundsDir, dbPath }) {
  if (_server) stopServer();
  _token = token;
  _port = port;
  _soundsDir = soundsDir;
  _dbPath = dbPath;

  _server = http.createServer(handleRequest);
  _server.listen(port, '0.0.0.0', () => {
    console.log(`[sync] Server listening on 0.0.0.0:${port}`);
  });
  _server.on('error', err => console.error('[sync] Server error:', err.message));

  return { port, localIp: getLocalIp() };
}

function stopServer() {
  if (_server) {
    _server.close();
    _server = null;
    console.log('[sync] Server stopped');
  }
}

function isRunning() {
  return _server !== null;
}

module.exports = { startServer, stopServer, isRunning, getLocalIp };
