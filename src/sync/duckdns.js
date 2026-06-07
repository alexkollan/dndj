'use strict';

const https = require('https');

let _intervalId = null;
let _lastUpdatedAt = null;
let _lastOk = null;

function updateOnce(domain, token) {
  return new Promise((resolve) => {
    const url = `https://www.duckdns.org/update?domains=${encodeURIComponent(domain)}&token=${encodeURIComponent(token)}&ip=`;
    https.get(url, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        _lastUpdatedAt = Date.now();
        _lastOk = body.trim() === 'OK';
        console.log(`[duckdns] Update ${_lastOk ? 'OK' : 'FAILED'} for ${domain}.duckdns.org`);
        resolve(_lastOk);
      });
    }).on('error', (err) => {
      _lastUpdatedAt = Date.now();
      _lastOk = false;
      console.error('[duckdns] Update error:', err.message);
      resolve(false);
    });
  });
}

function startUpdater(domain, token) {
  stopUpdater();
  updateOnce(domain, token);
  _intervalId = setInterval(() => updateOnce(domain, token), 30 * 60 * 1000);
}

function stopUpdater() {
  if (_intervalId) {
    clearInterval(_intervalId);
    _intervalId = null;
  }
}

function getStatus() {
  if (_lastUpdatedAt === null) return null;
  return { ok: _lastOk, updatedAt: _lastUpdatedAt };
}

module.exports = { updateOnce, startUpdater, stopUpdater, getStatus };
