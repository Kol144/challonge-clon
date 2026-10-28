(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TournamentBracket = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function shuffled(items) {
    const result = items.slice();
    for (let index = result.length - 1; index > 0; index -= 1) {
      const other = Math.floor(Math.random() * (index + 1));
      [result[index], result[other]] = [result[other], result[index]];
    }
    return result;
  }

  function nextPowerOfTwo(value) {
    let size = 2;
    while (size < value) size *= 2;
    return size;
  }

  function roundName(teamCount) {
    if (teamCount <= 2) return 'GRAN FINAL';
    if (teamCount <= 4) return 'SEMIFINALES';
    if (teamCount <= 8) return 'CUARTOS DE FINAL';
    if (teamCount <= 16) return 'OCTAVOS DE FINAL';
    if (teamCount <= 32) return 'DIECISEISAVOS DE FINAL';
    return `RONDA DE ${teamCount}`;
  }

  function makeMatch(teamIds, options = {}) {
    const bye = teamIds[1] == null;
    return {
      id: `match-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
      teamIds,
      scores: [null, null],
      winnerId: bye ? teamIds[0] : null,
      bye,
      isBronze: !!options.isBronze
    };
  }

  function createInitialRound(teamIds) {
    const entrants = shuffled(teamIds.filter(Boolean));
    if (entrants.length < 2) return null;
    const bracketSize = nextPowerOfTwo(entrants.length);
    const byes = bracketSize - entrants.length;
    const matches = entrants.slice(0, byes).map(id => makeMatch([id, null]));
    for (let index = byes; index < entrants.length; index += 2) {
      matches.push(makeMatch([entrants[index], entrants[index + 1]]));
    }
    return { name: roundName(bracketSize), teamCount: bracketSize, matches, seeded: true, isFinal: bracketSize === 2 };
  }

  function createNextRound(winnerIds) {
    const ids = shuffled(winnerIds.filter(Boolean));
    return {
      name: roundName(ids.length),
      teamCount: ids.length,
      matches: Array.from({ length: Math.floor(ids.length / 2) }, (_, index) => makeMatch([ids[index * 2], ids[index * 2 + 1]])),
      seeded: true,
      isFinal: ids.length === 2
    };
  }

  function createBronzeRound(loserIds) {
    const ids = loserIds.filter(Boolean);
    if (ids.length !== 2) return null;
    return { name: 'PARTIDO POR EL BRONCE', teamCount: 2, matches: [makeMatch(ids, { isBronze: true })], seeded: true, isBronze: true };
  }

  function validScore(score) {
    return typeof score === 'number' && Number.isFinite(score);
  }

  function updateRecords(tournament) {
    tournament.teams.forEach(team => { team.wins = 0; team.losses = 0; team.points = 0; });
    (tournament.rounds || []).forEach(round => round.matches.forEach(match => {
      if (!match.winnerId || !match.teamIds[1]) return;
      const loserId = match.teamIds.find(id => id !== match.winnerId);
      const winner = tournament.teams.find(team => team.id === match.winnerId);
      const loser = tournament.teams.find(team => team.id === loserId);
      if (winner) { winner.wins += 1; winner.points += 3; }
      if (loser) loser.losses += 1;
    }));
  }

  function setWinner(tournament, roundIndex, matchIndex, winnerId) {
    const round = tournament.rounds?.[roundIndex];
    const match = round?.matches?.[matchIndex];
    if (!match || match.bye || !match.teamIds.includes(winnerId)) return false;
    if (tournament.rounds.slice(roundIndex + 1).some(item => !item.isBronze)) return false;
    match.winnerId = winnerId;
    match.scores = [null, null];
    updateRecords(tournament);
    return true;
  }

  function advanceRound(tournament, roundIndex) {
    const rounds = tournament.rounds || [];
    const round = rounds[roundIndex];
    if (!round || round.isBronze || round.isFinal) return null;
    if (rounds.slice(roundIndex + 1).some(item => !item.isBronze)) return null;
    if (!round.matches.length || !round.matches.every(match => match.winnerId)) return null;
    const next = createNextRound(round.matches.map(match => match.winnerId));
    if (!next.matches.length) return null;
    rounds.push(next);
    if (round.name === 'SEMIFINALES' && round.matches.length === 2 && round.matches.every(match => match.teamIds[1])) {
      const losers = round.matches.map(match => match.teamIds.find(id => id !== match.winnerId));
      const bronze = createBronzeRound(losers);
      if (bronze) rounds.push(bronze);
    }
    updateRecords(tournament);
    return next;
  }

  function findApiBattle(tournament, match, teamById, cleanTag) {
    const firstTeam = teamById(match.teamIds[0]);
    const secondTeam = teamById(match.teamIds[1]);
    if (!firstTeam || !secondTeam) return null;
    const tagSet = team => new Set((team.playerTags || []).map(tag => {
      try { return cleanTag(tag); } catch { return ''; }
    }).filter(Boolean));
    const firstTags = tagSet(firstTeam);
    const secondTags = tagSet(secondTeam);
    const contains = (players, tags) => players.some(player => {
      try { return tags.has(cleanTag(player.tag)); } catch { return false; }
    });
    return (tournament.apiBattles || []).filter(battle => {
      const teams = Array.isArray(battle.teams) ? battle.teams : [];
      if (teams.length < 2 || !firstTags.size || !secondTags.size) return false;
      return teams.some((group, index) => contains(group, firstTags) && teams.some((other, otherIndex) => otherIndex !== index && contains(other, secondTags))) ||
        teams.some((group, index) => contains(group, secondTags) && teams.some((other, otherIndex) => otherIndex !== index && contains(other, firstTags)));
    }).sort((left, right) => String(right.battleTime || '').localeCompare(String(left.battleTime || '')))[0] || null;
  }

  function displayMode(mode) {
    const names = {
      gemGrab: 'Atrapagemas', brawlBall: 'Balón Brawl', heist: 'Atraco', bounty: 'Caza',
      knockout: 'Noqueo', hotZone: 'Zona restringida', soloShowdown: 'Supervivencia',
      duoShowdown: 'Supervivencia dúo', duels: 'Duelos', wipeout: 'Eliminación',
      basketBrawl: 'Basket Brawl', volleyBrawl: 'Volley Brawl', payload: 'Carga',
      paintBrawl: 'Paint Brawl', holdTheTrophy: 'A por el trofeo', ranked: 'Clasificatoria'
    };
    if (!mode) return 'Sin datos';
    return withoutAccents(names[mode] || mode.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, character => character.toUpperCase()));
  }

  function withoutAccents(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function renderMatchDetails(tournament, roundIndex, matchIndex, options) {
    const round = tournament.rounds?.[roundIndex];
    const match = round?.matches?.[matchIndex];
    if (!match || match.bye) return;
    const root = options.root;
    const escape = options.escapeHtml;
    const teamById = id => tournament.teams.find(team => team.id === id);
    const one = teamById(match.teamIds[0]);
    const two = teamById(match.teamIds[1]);
    const battle = findApiBattle(tournament, match, teamById, options.cleanTag);
    const fallbackGroup = team => (team.players || []).map((name, index) => ({
      name,
      tag: team.playerTags?.[index] || null,
      brawler: null,
      isStarPlayer: false
    }));
    const groups = battle?.teams?.length >= 2 ? battle.teams.slice(0, 2) : [fallbackGroup(one), fallbackGroup(two)];
    const hasTeamPlayer = (group, team) => group.some(player => (team.playerTags || []).some(tag => {
      try { return options.cleanTag(tag) === options.cleanTag(player.tag); } catch { return false; }
    }));
    if (battle?.teams?.length >= 2 && hasTeamPlayer(groups[0], two) && hasTeamPlayer(groups[1], one)) groups.reverse();
    const groupNames = [one.name, two.name];
    const configured = !!options.apiConfigured;
    const emptyTitle = options.trackingError ? 'No se pudo consultar la API' : configured ? 'Esperando datos de la API' : 'API sin conectar';
    const emptyMessage = options.trackingError || (configured
      ? 'No se ha encontrado en el historial una batalla entre estos dos equipos. Los datos aparecerán cuando la partida esté registrada en Brawl Stars.'
      : 'Conecta la API desde el menú Brawl Stars API para vincular las selecciones del historial a este enfrentamiento.');
    const meta = battle
      ? '<div class="match-api-meta"><span><small>MODO</small><strong>' + escape(displayMode(battle.mode)) + '</strong></span><span><small>MAPA</small><strong>' + escape(battle.map || 'Sin datos') + '</strong></span><span><small>HISTORIAL</small><strong>' + escape(battle.battleTime || 'Partida encontrada') + '</strong></span></div>'
      : '<div class="match-api-empty"><strong>' + escape(emptyTitle) + '</strong><p>' + escape(emptyMessage) + '</p></div>';
    const players = groups.map((group, groupIndex) => '<section class="match-player-team"><h3>' + escape(groupNames[groupIndex] || (groupIndex === 0 ? one.name : two.name)) + '</h3>' +
      (group.length ? group.map(player => '<div class="match-player"><span>' + escape(withoutAccents(player.name || 'Jugador')) + (player.isStarPlayer ? '<b class="star-player-badge" title="Jugador estelar">★ ESTELAR</b>' : '') + '</span><small>' + escape(player.tag || '') + '</small><strong>' + escape(withoutAccents(player.brawler || 'Brawler sin datos')) + '</strong></div>').join('') : '<p class="match-no-players">Sin jugadores registrados en la API.</p>') + '</section>').join('');
    const locked = tournament.rounds.slice(roundIndex + 1).some(item => !item.isBronze);
    const winnerChoice = '<section class="winner-choice"><div class="winner-choice-heading">ELIGE AL GANADOR · RESULTADO PROVISIONAL</div><div class="winner-choice-buttons">' +
      [one, two].map(team => '<button type="button" class="winner-choice-button' + (match.winnerId === team.id ? ' selected' : '') + '" data-winner-id="' + escape(team.id) + '" ' + (locked ? 'disabled' : '') + '>' + escape(team.name) + (match.winnerId === team.id ? ' ✓' : '') + '</button>').join('') +
      '</div>' + (locked ? '<small>El ganador quedó fijado al pasar de ronda.</small>' : '') + '</section>';
    root.innerHTML = '<div class="match-detail-versus"><span>' + escape(one.name) + '</span><b>VS</b><span>' + escape(two.name) + '</span></div>' + winnerChoice + meta +
      '<div class="match-api-source">' + (battle ? 'Datos encontrados en el historial de Brawl Stars' : 'Selecciones y jugador estelar pendientes de los datos de la partida') + '</div>' +
      '<div class="match-player-grid">' + players + '</div>';
    root.querySelectorAll('[data-winner-id]:not([disabled])').forEach(button => {
      button.onclick = () => options.onWinnerSelected?.(button.dataset.winnerId);
    });
  }

  function render(tournament, area, options) {
    const escape = options.escapeHtml;
    if (!tournament.teams.length) {
      area.innerHTML = '<div class="empty-state"><strong>Tu bracket empieza con los equipos</strong>Añade participantes desde el menú Equipos.</div>';
      return;
    }
    const played = round => round.matches.some(match => match.winnerId || match.scores?.some(score => score !== null && score !== undefined));
    if (!tournament.rounds?.length || (tournament.rounds.length === 1 && !tournament.rounds[0].seeded && !played(tournament.rounds[0]))) {
      const opening = createInitialRound(tournament.teams.map(team => team.id));
      tournament.rounds = opening ? [opening] : [];
      options.save();
    }
    const rounds = tournament.rounds || [];
    if (!rounds.length) {
      area.innerHTML = '<div class="empty-state"><strong>Hace falta al menos 2 equipos</strong>Añade otro equipo para sortear el bracket.</div>';
      return;
    }
    rounds.forEach((round, index) => {
      round.teamCount = round.teamCount || Math.max(2, round.matches.length * 2);
      round.isBronze = round.isBronze || round.name === 'PARTIDO POR EL BRONCE';
      round.isFinal = round.isFinal || round.name === 'GRAN FINAL' || (index === rounds.length - 1 && round.matches.length === 1 && !round.isBronze);
      round.matches.forEach(match => {
        match.scores = Array.isArray(match.scores) ? match.scores : [null, null];
        match.bye = match.bye || match.teamIds[1] == null;
        if (match.bye && !match.winnerId) match.winnerId = match.teamIds[0];
      });
    });
    const teamById = id => tournament.teams.find(team => team.id === id);
    const championRound = rounds.find(round => round.isFinal && round.matches[0]?.winnerId);
    const champion = championRound ? teamById(championRound.matches[0].winnerId) : null;
    const lastPlayableIndex = rounds.reduce((last, round, index) => round.isBronze ? last : index, -1);
    const columns = rounds.map((round, roundIndex) => {
      const cards = round.matches.map((match, matchIndex) => {
        const one = teamById(match.teamIds[0]);
        const two = teamById(match.teamIds[1]);
        const label = match.isBronze ? 'PARTIDO POR EL BRONCE' : round.name;
        const title = one && two ? one.name + ' vs ' + two.name : (one?.name || 'Partido');
        const loserId = match.winnerId && two ? match.teamIds.find(id => id !== match.winnerId) : null;
        const cardClass = 'match' + (round.isFinal ? ' final-card' : '') + (match.isBronze ? ' bronze-card' : '') + (!two ? ' bye-match' : '');
        const teamRow = team => '<div class="team-row' + (match.winnerId === team?.id ? ' winner' : '') + (loserId === team?.id ? ' eliminated' : '') + '"><span>' + (team ? escape(team.name) : 'Por decidir') + '</span>' + (match.winnerId === team?.id ? '<small class="winner-label">GANADOR</small>' : '') + '</div>';
        return '<article class="' + cardClass + '" ' + (two ? 'role="button" tabindex="0" data-round-index="' + roundIndex + '" data-match-index="' + matchIndex + '" aria-label="Ver detalles: ' + escape(title) + '"' : 'aria-disabled="true"') + '>' +
          '<div class="match-kicker">' + escape(label) + '</div>' + teamRow(one) + (two ? teamRow(two) : '<div class="team-row bye-label">PASA DIRECTAMENTE</div>') +
          (two ? '<div class="match-hint">Pulsa para elegir el ganador provisional</div>' : '') + '</article>';
      }).join('');
      const canAdvance = roundIndex === lastPlayableIndex && !round.isBronze && !round.isFinal && round.matches.length && round.matches.every(match => match.winnerId);
      const advanceButton = canAdvance ? '<button type="button" class="advance-round" data-advance-round="' + roundIndex + '">MEZCLAR EQUIPOS Y PASAR A ' + escape(roundName(round.matches.length)) + '</button>' : '';
      return '<section class="round"><h3>' + escape(round.name) + '</h3>' + cards + advanceButton + '</section>';
    }).join('');
    area.innerHTML = '<div class="bracket-grid" style="grid-template-columns:repeat(' + rounds.length + ',minmax(250px,1fr))">' + columns + '</div>' +
      (champion ? '<div class="champion"><span class="eyebrow">CAMPEÓN</span><strong>' + escape(champion.name) + '</strong></div>' : '');
    area.onclick = event => {
      const advanceButton = event.target.closest('[data-advance-round]');
      if (advanceButton) {
        const next = advanceRound(tournament, Number(advanceButton.dataset.advanceRound));
        if (!next) return;
        options.save();
        options.toast('Equipos mezclados · comienza ' + next.name.toLowerCase());
        options.onUpdate();
        return;
      }
      if (event.target.closest('.score')) return;
      const card = event.target.closest('[data-round-index]');
      if (card) options.openMatch(Number(card.dataset.roundIndex), Number(card.dataset.matchIndex));
    };
    area.onkeydown = event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (event.target.closest('.score')) return;
      const card = event.target.closest('[data-round-index]');
      if (!card) return;
      event.preventDefault();
      options.openMatch(Number(card.dataset.roundIndex), Number(card.dataset.matchIndex));
    };
  }

  return { shuffled, nextPowerOfTwo, roundName, createInitialRound, createNextRound, createBronzeRound, setWinner, advanceRound, render, renderMatchDetails };
});
