const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';

const INDEX_FILE = path.join(__dirname, 'index.html');

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
}

async function handleProxy(targetUrl, res) {
  let parsed;
  try {
    parsed = new URL(targetUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Only http and https protocols are supported');
    }
  } catch (err) {
    setCorsHeaders(res);
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`Error "Invalid target URL: ${err.message}"`);
    return;
  }

  const startTime = Date.now();
  try {
    const upstream = await fetch(parsed.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'Jasmin-Client-Simulator-Proxy/1.0',
        'Accept': '*/*'
      },
      signal: AbortSignal.timeout(25000)
    });

    const body = await upstream.text();
    const duration = Date.now() - startTime;

    setCorsHeaders(res);
    res.setHeader('X-Proxy-Latency-Ms', String(duration));
    res.writeHead(upstream.status, {
      'Content-Type': upstream.headers.get('content-type') || 'text/plain; charset=utf-8'
    });
    res.end(body);
  } catch (err) {
    const duration = Date.now() - startTime;
    setCorsHeaders(res);
    res.setHeader('X-Proxy-Latency-Ms', String(duration));

    const status = err.name === 'TimeoutError' ? 504 : 502;
    res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`Error "Proxy error: ${err.message || 'Upstream connection failed'}"`);
  }
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 1e6) { // 1MB limit
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!raw.trim()) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  // Favicon request
  if (reqUrl.pathname === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check endpoint
  if (reqUrl.pathname === '/health' || reqUrl.pathname === '/api/health') {
    setCorsHeaders(res);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
    return;
  }

  // Proxy endpoint
  if (reqUrl.pathname === '/api/proxy') {
    if (req.method === 'GET') {
      const target = reqUrl.searchParams.get('url');
      if (!target) {
        setCorsHeaders(res);
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Error "Missing ?url= query parameter"');
        return;
      }
      await handleProxy(target, res);
      return;
    }

    if (req.method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        let target = body.url || body.targetUrl;

        // If target was not given as a full URL, support constituent fields:
        if (!target && body.base) {
          const params = new URLSearchParams();
          if (body.username) params.set('username', body.username);
          if (body.password) params.set('password', body.password);
          if (body.from) params.set('from', body.from);
          if (body.to) params.set('to', body.to);
          if (body.content) params.set('content', body.content);
          target = `${body.base.replace(/\/+$/, '')}/api/send/?${params.toString()}`;
        }

        if (!target) {
          setCorsHeaders(res);
          res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Error "Missing url in JSON request body"');
          return;
        }

        await handleProxy(target, res);
      } catch (err) {
        setCorsHeaders(res);
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`Error "Bad Request: ${err.message}"`);
      }
      return;
    }

    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Method Not Allowed');
    return;
  }

  // Fallback direct /api/send proxy if apiBase query is given
  if (reqUrl.pathname === '/api/send/' || reqUrl.pathname === '/api/send') {
    const apiBase = reqUrl.searchParams.get('apiBase');
    if (apiBase) {
      const forwardParams = new URLSearchParams(reqUrl.searchParams);
      forwardParams.delete('apiBase');
      const target = `${apiBase.replace(/\/+$/, '')}/api/send/?${forwardParams.toString()}`;
      await handleProxy(target, res);
      return;
    }
  }

  // Serve static UI
  if ((req.method === 'GET' || req.method === 'HEAD') && (reqUrl.pathname === '/' || reqUrl.pathname === '/index.html')) {
    fs.readFile(INDEX_FILE, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Failed to load index.html');
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': Buffer.byteLength(data),
        'Cache-Control': 'no-cache'
      });
      if (req.method === 'HEAD') {
        res.end();
      } else {
        res.end(data);
      }
    });
    return;
  }

  // 404 for other routes
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
});

server.listen(PORT, HOST, () => {
  console.log(`Jasmin Client Simulator listening on http://${HOST}:${PORT}`);
});
