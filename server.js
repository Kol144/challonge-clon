'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { cleanTag } = require('./brawl-stars');

const PORT = Number(process.env.PORT || 3000);
const TOKEN = process.env.BRAWL_STARS_API_TOKEN;
const CACHE_TTL_MS = 30_000;
const cache = new Map();

function allowedOrigins() {
  return (process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || 'http://localhost:3000,http://localhost:8000,http://127.0.0.1:8000')
    .split(',').map(origin => origin.trim()).filter(Boolean);
}

function corsHeaders(req) {
  const origin = req.headers.origin;
  const headers = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin'
  };
  if (origin && allowedOrigins().includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function send(req, res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...corsHeaders(req) });
  res.end(JSON.stringify(body));
}

function statusError(status) {
  if (status === 400) return ['INVALID_TAG', 'El tag del jugador no tiene un formato válido.'];
  if (status === 404) return ['PLAYER_NOT_FOUND', 'La API oficial no encontró ese jugador.'];
  if (status === 403 || status === 401) return ['API_AUTH_ERROR', 'La API oficial rechazó las credenciales o el acceso.'];
  if (status === 429) return ['RATE_LIMITED', 'Se alcanzó el límite temporal de peticiones. Inténtalo más tarde.'];
  if (status === 503) return ['API_UNAVAILABLE', 'La API de Brawl Stars está temporalmente fuera de servicio.'];
  return ['UPSTREAM_ERROR', 'La API de Brawl Stars devolvió un error.'];
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders(req)); return res.end(); }
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html' || req.url === '/brawl-stars.js')) {
    const file = req.url === '/brawl-stars.js' ? 'brawl-stars.js' : 'index.html';
    const contentType = file.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8';
    res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' });
    return fs.createReadStream(path.join(__dirname, file)).pipe(res);
  }
  if (req.method === 'GET' && req.url?.startsWith('/assets/')) {
    let assetPath;
    try { assetPath = path.resolve(__dirname, `.${decodeURIComponent(new URL(req.url, 'http://localhost').pathname)}`); }
    catch { return send(req, res, 400, { code: 'INVALID_ASSET_PATH', message: 'La ruta del recurso no es válida.' }); }
    const assetRoot = path.resolve(__dirname, 'assets') + path.sep;
    if (!assetPath.toLowerCase().startsWith(assetRoot.toLowerCase())) return send(req, res, 404, { code: 'NOT_FOUND', message: 'Recurso no encontrado.' });
    const contentTypes = { '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.json': 'application/json; charset=utf-8', '.otf': 'font/otf', '.png': 'image/png' };
    const contentType = contentTypes[path.extname(assetPath).toLowerCase()];
    if (!contentType) return send(req, res, 404, { code: 'NOT_FOUND', message: 'Recurso no encontrado.' });
    return fs.stat(assetPath, (error, stat) => {
      if (error || !stat.isFile()) return send(req, res, 404, { code: 'NOT_FOUND', message: 'Recurso no encontrado.' });
      res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=3600' });
      fs.createReadStream(assetPath).pipe(res);
    });
  }
  const match = req.url?.match(/^\/api\/brawl-stars\/players\/([^/]+)(?:\/(battlelog))?(?:\?.*)?$/);
  if (req.method !== 'GET' || !match) return send(req, res, 404, { code: 'NOT_FOUND', message: 'Ruta no encontrada.' });
  const requestToken = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const apiToken = requestToken || TOKEN;
  if (!apiToken) return send(req, res, 503, { code: 'SERVER_NOT_CONFIGURED', message: 'Pega tu token en la configuración de Brawl Stars API o configúralo en el servidor.' });
  let tag;
  try { tag = cleanTag(decodeURIComponent(match[1])); }
  catch (error) { return send(req, res, 400, { code: 'INVALID_TAG', message: error.message }); }
  const endpoint = match[2] === 'battlelog' ? 'battlelog' : 'profile';
  const cacheKey = endpoint + ':' + tag;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.time < CACHE_TTL_MS) return send(req, res, 200, cached.data);
  try {
    const upstream = await fetch(`https://api.brawlstars.com/v1/players/%23${encodeURIComponent(tag)}${endpoint === 'battlelog' ? '/battlelog' : ''}`, {
      headers: { Authorization: `Bearer ${apiToken}`, Accept: 'application/json' }, signal: AbortSignal.timeout(10_000)
    });
    const data = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      const [code, message] = statusError(upstream.status);
      return send(req, res, upstream.status === 404 ? 404 : upstream.status === 429 ? 429 : 502, { code, message, upstreamStatus: upstream.status });
    }
    if (!data || (endpoint === 'battlelog' ? !Array.isArray(data.items) : typeof data.name !== 'string')) return send(req, res, 502, { code: 'INVALID_UPSTREAM_RESPONSE', message: 'La respuesta oficial no contiene los datos esperados.' });
    cache.set(cacheKey, { time: Date.now(), data });
    return send(req, res, 200, data);
  } catch (error) {
    const timeout = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    return send(req, res, timeout ? 504 : 502, { code: timeout ? 'UPSTREAM_TIMEOUT' : 'CONNECTION_ERROR', message: timeout ? 'La consulta a Brawl Stars agotó el tiempo de espera.' : 'No se pudo conectar con la API de Brawl Stars.' });
  }
});

server.listen(PORT, () => console.log(`Brawl Stars API proxy escuchando en el puerto ${PORT}`));
