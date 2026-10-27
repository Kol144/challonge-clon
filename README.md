# Bracket Brawl: integración de datos Brawl Stars

La clave oficial permanece únicamente en el proceso del servidor. La página estática de GitHub Pages no puede ejecutar el proxy ni custodiar el token; para consultas reales hay que ejecutar `server.js` en un servicio Node.js y configurar `BRAWL_STARS_API_TOKEN` como variable privada del entorno.

## Configuración local

1. Crea una clave en el portal oficial de desarrolladores: https://developer.brawlstars.com/ . No la pongas en `index.html`, en el repositorio ni en el navegador.
2. Configura `BRAWL_STARS_API_TOKEN` en el entorno del servidor. `.env.example` solo muestra los nombres de configuración; Node no lee archivos `.env` automáticamente.
3. Ejecuta `npm start` con Node 18 o posterior. La ruta del proxy es `GET /api/brawl-stars/players/{tag}/battlelog`.
4. Desde la página, el adaptador se expone como `window.BrawlStarsData`. Ejemplo: `window.BrawlStarsData.loadPlayerBattleLog('#TAG', { baseUrl: 'https://tu-servidor.example' })`.

`loadPlayerBattleLog` devuelve partidas normalizadas y publica el evento `brawlstars:battlelog` con `{ playerTag, battles }`. También acepta `onData(battles)` como punto de entrega a código consumidor. Cada batalla conserva los datos ausentes como `null`, expone `dataAvailable` y marca `isStarPlayer` solo si la API entrega un tag estelar que coincide con el tag del participante. Admite participantes bajo `battle.teams` o `battle.players`.

El sistema de torneo actual guarda nombres de jugadores como texto, no tags, y no tiene aún una función que consuma datos de Brawl Stars. Por eso no se asocian jugadores automáticamente por nombres potencialmente ambiguos ni se cambia su presentación. El adaptador entrega la estructura lista para que esa asociación se haga cuando exista una interfaz con tags.

El proxy mantiene una caché en memoria de 30 segundos por tag y traduce errores de autenticación, tags inválidos, jugador no encontrado, límite de peticiones y fallos de conexión. El alojamiento estático de GitHub Pages no sirve `server.js`; para producción, aloja el proxy por separado y pasa su URL como `baseUrl`.

## Verificación

Ejecuta `npm test` para comprobar validación de tags, estructuras de batalla, datos incompletos y detección del jugador estelar. Las pruebas usan fixtures estructurales; no sustituyen una consulta real. Para confirmar datos reales hace falta una clave privada válida y un tag de jugador.
