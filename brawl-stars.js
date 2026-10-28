/* Data-only Brawl Stars adapter. It intentionally does not alter the UI. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BrawlStarsData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function cleanTag(tag) {
    if (typeof tag !== 'string') throw new TypeError('El tag del jugador debe ser texto.');
    const value = tag.trim().replace(/^#/, '').toUpperCase();
    if (!value || !/^[0289PYLQGRJCUV]+$/.test(value)) throw new TypeError('El tag de jugador no tiene un formato válido.');
    return value;
  }

  function normalizePlayer(player, starTag, starName) {
    const tag = typeof player?.tag === 'string' ? player.tag : null;
    const playerTag = tag ? tag.replace(/^#/, '').toUpperCase() : null;
    const isStarPlayer = !!starTag && !!playerTag && playerTag === starTag;
    return {
      name: typeof player?.name === 'string' ? player.name : null,
      tag,
      brawler: typeof player?.brawler?.name === 'string' ? player.brawler.name : null,
      brawlerId: Number.isFinite(player?.brawler?.id) ? player.brawler.id : null,
      brawlerPower: Number.isFinite(player?.brawler?.power) ? player.brawler.power : null,
      brawlerTrophies: Number.isFinite(player?.brawler?.trophies) ? player.brawler.trophies : null,
      isStarPlayer,
      dataAvailable: { name: typeof player?.name === 'string', tag: !!tag, brawler: typeof player?.brawler?.name === 'string' }
    };
  }

  function normalizeBattleLog(payload) {
    const items = Array.isArray(payload) ? payload : payload?.items;
    if (!Array.isArray(items)) throw new TypeError('La respuesta del historial no contiene una lista de partidas.');
    return items.map((entry) => {
      const battle = entry?.battle && typeof entry.battle === 'object' ? entry.battle : {};
      const event = entry?.event && typeof entry.event === 'object' ? entry.event : {};
      const star = battle.starPlayer && typeof battle.starPlayer === 'object' ? battle.starPlayer : null;
      const starTag = typeof star?.tag === 'string' ? star.tag.replace(/^#/, '').toUpperCase() : null;
      const teams = Array.isArray(battle.teams) ? battle.teams : [];
      const groups = teams.length ? teams.filter(Array.isArray) : (Array.isArray(battle.players) ? [battle.players] : []);
      const normalizedTeams = groups.map(group => group.filter(p => p && typeof p === 'object').map(p => normalizePlayer(p, starTag, star?.name ?? null)));
      const participants = normalizedTeams.flat();
      // Prefer the official tag. If it is absent, use an exact name only when it
      // identifies one participant uniquely; never guess between duplicate names.
      if (star && !starTag && typeof star.name === 'string') {
        const matchingParticipants = participants.filter(p => p.name === star.name);
        if (matchingParticipants.length === 1) matchingParticipants[0].isStarPlayer = true;
      }
      const starPlayer = star ? {
        name: typeof star.name === 'string' ? star.name : null,
        tag: typeof star.tag === 'string' ? star.tag : null,
        available: true
      } : { name: null, tag: null, available: false };
      return {
        battleTime: typeof entry?.battleTime === 'string' ? entry.battleTime : null,
        result: typeof battle.result === 'string' ? battle.result : null,
        type: typeof battle.type === 'string' ? battle.type : null,
        trophyChange: Number.isFinite(battle.trophyChange) ? battle.trophyChange : null,
        duration: Number.isFinite(battle.duration) ? battle.duration : null,
        rank: Number.isFinite(battle.rank) ? battle.rank : null,
        mode: typeof battle.mode === 'string' ? battle.mode : (typeof event.mode === 'string' ? event.mode : null),
        modeId: Number.isFinite(Number(event.modeId)) && Number(event.modeId) > 0 ? Number(event.modeId) : null,
        map: typeof event.map === 'string' ? event.map : null,
        starPlayer,
      teams: teams.length ? normalizedTeams : [],
        participants,
        dataAvailable: {
          battleTime: typeof entry?.battleTime === 'string',
          result: typeof battle.result === 'string',
          mode: typeof battle.mode === 'string' || typeof event.mode === 'string',
          map: typeof event.map === 'string',
          starPlayer: !!star,
          teams: teams.length > 0
        }
      };
    });
  }

  async function loadPlayer(tag, options) {
    const normalizedTag = cleanTag(tag);
    const baseUrl = (options?.baseUrl || '').replace(/\/$/, '');
    if (!baseUrl) throw new Error('Configura la URL del servidor Brawl Stars antes de consultar.');
    const response = await (options?.fetch || fetch)(`${baseUrl}/api/brawl-stars/players/${encodeURIComponent(normalizedTag)}`, { headers: options?.token ? { Authorization: `Bearer ${options.token}` } : {}, signal: AbortSignal.timeout(12_000) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(body.message || 'No se encontró el jugador.'); error.status=response.status; error.code=body.code||'API_ERROR'; throw error; }
    if (typeof body?.name !== 'string' || !body.name.trim()) throw new Error('La API no devolvió el nombre del jugador.');
    return { ...body, tag: body.tag || `#${normalizedTag}`, name: body.name.trim() };
  }

  async function loadPlayerBattleLog(tag, options) {
    const normalizedTag = cleanTag(tag);
    const baseUrl = (options?.baseUrl || '').replace(/\/$/, '');
    if (!baseUrl) throw new Error('Configura la URL del servidor Brawl Stars antes de consultar.');
    const response = await (options?.fetch || fetch)(`${baseUrl}/api/brawl-stars/players/${encodeURIComponent(normalizedTag)}/battlelog`, { headers: options?.token ? { Authorization: `Bearer ${options.token}` } : {}, signal: AbortSignal.timeout(12_000) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body.message || 'No se pudo obtener el historial de Brawl Stars.');
      error.status = response.status;
      error.code = body.code || 'API_ERROR';
      throw error;
    }
    const battles = normalizeBattleLog(body);
    if (typeof options?.onData === 'function') options.onData(battles);
    if (typeof root?.dispatchEvent === 'function' && typeof root.CustomEvent === 'function') {
      root.dispatchEvent(new root.CustomEvent('brawlstars:battlelog', { detail: { playerTag: `#${normalizedTag}`, battles } }));
    }
    return battles;
  }

  return { cleanTag, normalizeBattleLog, loadPlayer, loadPlayerBattleLog };
});
