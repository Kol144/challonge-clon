'use strict';

const http = require('node:http');
const { cleanTag } = require('./brawl-stars');

const PORT = Number(process.env.PORT || 3000);
const TOKEN = process.env.BRAWL_STARS_API_TOKEN;
const CACHE_TTL_MS = 30_000;
const cache = new Map();

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'http://localhost:3000', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
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
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const match = req.url?.match(/^\/api\/brawl-stars\/players\/([^/]+)(?:\/(battlelog))?(?:\?.*)?$/);
  if (req.method !== 'GET' || !match) return send(res, 404, { code: 'NOT_FOUND', message: 'Ruta no encontrada.' });
  if (!TOKEN) return send(res, 503, { code: 'SERVER_NOT_CONFIGURED', message: 'Falta configurar BRAWL_STARS_API_TOKEN en el servidor.' });
  let tag;
  try { tag = cleanTag(decodeURIComponent(match[1])); }
  catch (error) { return send(res, 400, { code: 'INVALID_TAG', message: error.message }); }
  const endpoint = match[2] === 'battlelog' ? 'battlelog' : 'profile';
  const cacheKey = endpoint + ':' + tag;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.time < CACHE_TTL_MS) return send(res, 200, cached.data);
  try {
    const upstream = await fetch(`https://api.brawlstars.com/v1/players/%23${encodeURIComponent(tag)}${endpoint === 'battlelog' ? '/battlelog' : ''}`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' }, signal: AbortSignal.timeout(10_000)
    });
    const data = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      const [code, message] = statusError(upstream.status);
      return send(res, upstream.status === 404 ? 404 : upstream.status === 429 ? 429 : upstream.status >= 500 ? 502 : 502, { code, message, upstreamStatus: upstream.status });
    }
    if (!data || (endpoint === 'battlelog' ? !Array.isArray(data.items) : typeof data.name !== 'string')) return send(res, 502, { code: 'INVALID_UPSTREAM_RESPONSE', message: 'La respuesta oficial no contiene los datos esperados.' });
    cache.set(cacheKey, { time: Date.now(), data });
    return send(res, 200, data);
  } catch (error) {
    const timeout = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    return send(res, timeout ? 504 : 502, { code: timeout ? 'UPSTREAM_TIMEOUT' : 'CONNECTION_ERROR', message: timeout ? 'La consulta a Brawl Stars agotó el tiempo de espera.' : 'No se pudo conectar con la API de Brawl Stars.' });
  }
});

server.listen(PORT, () => console.log(`Brawl Stars API proxy escuchando en el puerto ${PORT}`));
