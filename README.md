# Bracket Brawl: integración de datos Brawl Stars

El proxy de `server.js` debe ejecutarse en un servicio Node.js. La página incluye un campo de contraseña que mantiene el token solo en memoria y lo envía en las consultas; también puedes configurarlo como variable privada `BRAWL_STARS_API_TOKEN` en el servidor. GitHub Pages por sí solo no puede ejecutar el proxy.

## Configuración local

1. Crea una clave en el portal oficial de desarrolladores: https://developer.brawlstars.com/ . No la guardes en `index.html`, en el repositorio ni en el almacenamiento del navegador. El campo de la web solo la conserva en memoria durante esa sesión.
2. Puedes introducir el token en la página de configuración de API o guardarlo como `BRAWL_STARS_API_TOKEN` en el entorno del servidor. `.env.example` solo muestra los nombres de configuración; Node no lee archivos `.env` automáticamente.
3. Ejecuta `npm start` con Node 18 o posterior. Las rutas del proxy son `GET /api/brawl-stars/players/{tag}` para consultar el perfil y `GET /api/brawl-stars/players/{tag}/battlelog` para el historial.
4. Entra al torneo y abre el menú **Brawl Stars API**. Guarda la URL pública del servidor. El formulario pide los tres tags; al comprobar cada tag muestra ✓ y el nombre del jugador si la API lo encuentra, o ✕ si no existe. Desde **Vista de bracket**, pulsa **Iniciar torneo y seguimiento**. El navegador consulta los historiales registrados al iniciar y cada 60 segundos, y guarda las partidas nuevas en **Partidas recientes**.

`loadPlayerBattleLog` devuelve partidas normalizadas y publica el evento `brawlstars:battlelog` con `{ playerTag, battles }`. También acepta `onData(battles)` como punto de entrega a código consumidor. Cada batalla conserva los datos ausentes como `null`, expone `dataAvailable` y marca `isStarPlayer` solo si la API entrega un tag estelar que coincide con el tag del participante. Admite participantes bajo `battle.teams` o `battle.players`.

Los nombres se obtienen del perfil oficial de cada tag, y los tags se guardan con cada equipo. La consulta se asocia por tag oficial, no por nombre. El seguimiento recupera el historial de batalla de cada tag y deduplica las partidas por cuenta y hora. GitHub Pages por sí solo no ejecuta el servidor; hace falta alojar `server.js` en un servicio Node y configurar en ese servicio `BRAWL_STARS_API_TOKEN` y `ALLOWED_ORIGIN` con el dominio de GitHub Pages. Mantén el token en el servidor siempre que sea posible. Si lo introduces en la web, se envía al backend desde el navegador y el usuario que lo introduce asume ese riesgo.

El proxy mantiene una caché en memoria de 30 segundos por tag y traduce errores de autenticación, tags inválidos, jugador no encontrado, límite de peticiones y fallos de conexión. El alojamiento estático de GitHub Pages no sirve `server.js`; para producción, aloja el proxy por separado y pasa su URL como `baseUrl`.

## Verificación

Ejecuta `npm test` para comprobar validación de tags, estructuras de batalla, datos incompletos y detección del jugador estelar. Las pruebas usan fixtures estructurales; no sustituyen una consulta real. Para confirmar datos reales hace falta una clave privada válida y un tag de jugador.
