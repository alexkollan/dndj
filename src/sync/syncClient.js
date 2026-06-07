'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

function httpGetJson(url, headers) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { headers }, (res) => {
      if (res.statusCode === 401) return reject(new Error('Invalid auth token — check your sync token'));
      if (res.statusCode !== 200) return reject(new Error(`Server returned HTTP ${res.statusCode}`));
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Server returned invalid JSON')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(12000, () => { req.destroy(); reject(new Error('Connection timed out')); });
  });
}

function httpDownload(url, headers, destPath) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const tmpPath = destPath + '.synctmp';
    const dir = path.dirname(tmpPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const file = fs.createWriteStream(tmpPath);

    const req = lib.get(url, { headers }, (res) => {
      if (res.statusCode === 401) {
        file.close();
        try { fs.unlinkSync(tmpPath); } catch {}
        return reject(new Error('Invalid auth token'));
      }
      if (res.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(tmpPath); } catch {}
        return reject(new Error(`HTTP ${res.statusCode} for ${path.basename(destPath)}`));
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          try {
            if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
            fs.renameSync(tmpPath, destPath);
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      });
    });

    req.on('error', (err) => {
      file.close();
      try { fs.unlinkSync(tmpPath); } catch {}
      reject(err);
    });
    req.setTimeout(120000, () => {
      req.destroy();
      reject(new Error(`Download timed out: ${path.basename(destPath)}`));
    });
  });
}

async function pullFromServer({ serverUrl, token, soundsDir, dbPath, onProgress }) {
  const base = serverUrl.replace(/\/$/, '');
  const headers = { 'Authorization': `Bearer ${token}` };

  onProgress({ phase: 'connecting', text: 'Connecting to server...' });
  const status = await httpGetJson(`${base}/status`, headers);
  if (!status.ok) throw new Error('Server reported an error');

  onProgress({ phase: 'db', text: 'Downloading database...' });
  const tempDbPath = dbPath.replace(/\.sqlite$/, '_incoming.sqlite');
  await httpDownload(`${base}/db`, headers, tempDbPath);

  onProgress({ phase: 'manifest', text: 'Fetching file manifest...' });
  const { files } = await httpGetJson(`${base}/manifest`, headers);

  const toDownload = files.filter(f => {
    const localPath = path.join(soundsDir, ...f.path.split('/'));
    if (!fs.existsSync(localPath)) return true;
    return fs.statSync(localPath).size !== f.size;
  });

  onProgress({ phase: 'files', text: `Syncing ${toDownload.length} file(s)...`, total: toDownload.length, done: 0 });

  for (let i = 0; i < toDownload.length; i++) {
    const f = toDownload[i];
    const localPath = path.join(soundsDir, ...f.path.split('/'));
    await httpDownload(`${base}/file?p=${encodeURIComponent(f.path)}`, headers, localPath);
    onProgress({ phase: 'files', total: toDownload.length, done: i + 1, current: f.path });
  }

  return { tempDbPath, filesDownloaded: toDownload.length };
}

module.exports = { pullFromServer };
