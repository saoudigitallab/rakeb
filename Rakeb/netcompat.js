// Compatibilité Electron : net.fetch n'existe qu'à partir d'Electron 25. Pour la version Windows 7/8/8.1
// (Electron 22) on retombe sur net.request, avec la même interface (status, arrayBuffer, annulation par signal).
function abortError() {
  const e = new Error('Aborted');
  e.name = 'AbortError';
  return e;
}

function fetchCompat(net, url, init) {
  init = init || {};
  if (typeof net.fetch === 'function') return net.fetch(url, init);
  return new Promise((resolve, reject) => {
    const req = net.request({ url, method: init.method || 'GET', redirect: 'follow' });
    Object.keys(init.headers || {}).forEach((k) => req.setHeader(k, String(init.headers[k])));
    if (init.signal) {
      if (init.signal.aborted) { reject(abortError()); return; }
      init.signal.addEventListener('abort', () => { try { req.abort(); } catch (e) { /* déjà terminé */ } reject(abortError()); });
    }
    req.on('response', (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('error', reject);
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        resolve({
          status: res.statusCode,
          arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
        });
      });
    });
    req.on('error', reject);
    if (init.body !== undefined) req.write(init.body);
    req.end();
  });
}

module.exports = { fetchCompat };
