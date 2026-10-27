# Bracket Brawl: integración de datos Brawl Stars

La vista **Resultado de prueba** usa la plantilla `assets/resultado-plantilla.jpeg`, la tipografía `assets/spray-letters.otf`, los retratos de `assets/brawlers/` y los iconos de modo guardados en `assets/modes/` y la corona estelar transparente `assets/corona-estelar.png`. `assets/brawlers.json` enumera los 108 retratos disponibles. Los iconos de modo se obtuvieron del CDN público de Brawlify. Los recursos se sirven desde el mismo origen y se pueden empaquetar junto con la web al publicarla o convertirla en app.

El proxy de `server.js` debe ejecutarse en un servicio Node.js. La página incluye un campo de contraseña que mantiene el token solo en memoria y lo envía en las consultas; también puedes configurarlo como variable privada `BRAWL_STARS_API_TOKEN` en el servidor. GitHub Pages por sí solo no puede ejecutar el proxy.

## Configuración local

1. Crea una clave en el portal oficial de desarrolladores: https://developer.brawlstars.com/ . No la guardes en `index.html`, en el repositorio ni en el almacenamiento del navegador. El campo de la web solo la conserva en memoria durante esa sesión.
2. Puedes introducir el token en la página de configuración de API o guardarlo como `BRAWL_STARS_API_TOKEN` en el entorno del servidor. `.env.example` solo muestra los nombres de configuración; Node no lee archivos `.env` automáticamente.
3. Ejecuta `node server.js` con Node 18 o posterior y abre `http://localhost:3000/`. El mismo servidor sirve la página y la API para evitar problemas de CORS locales. Las rutas del proxy son `GET /api/brawl-stars/players/{tag}` para consultar el perfil y `GET /api/brawl-stars/players/{tag}/battlelog` para el historial.
4. Entra al torneo y abre el menú **Brawl Stars API**. Guarda la URL pública del servidor. El formulario pide los tres tags; al comprobar cada tag muestra ✓ y el nombre del jugador si la API lo encuentra, o ✕ si no existe. Desde **Vista de bracket**, pulsa **Iniciar torneo y seguimiento**. El navegador consulta los historiales registrados al iniciar y cada 60 segundos, y guarda las partidas nuevas en **Partidas recientes**.

`loadPlayerBattleLog` devuelve partidas normalizadas y publica el evento `brawlstars:battlelog` con `{ playerTag, battles }`. También acepta `onData(battles)` como punto de entrega a código consumidor. Cada batalla conserva los datos ausentes como `null`, expone `dataAvailable` y marca `isStarPlayer` solo si la API entrega un tag estelar que coincide con el tag del participante. Admite participantes bajo `battle.teams` o `battle.players`.

Los nombres se obtienen del perfil oficial de cada tag, y los tags se guardan con cada equipo. La consulta se asocia por tag oficial, no por nombre. El seguimiento recupera el historial de batalla de cada tag y deduplica las partidas por cuenta y hora. GitHub Pages por sí solo no ejecuta el servidor; hace falta alojar `server.js` en un servicio Node y configurar en ese servicio `BRAWL_STARS_API_TOKEN` y `ALLOWED_ORIGIN` con el dominio de GitHub Pages. Mantén el token en el servidor siempre que sea posible. Si lo introduces en la web, se envía al backend desde el navegador y el usuario que lo introduce asume ese riesgo.

El proxy mantiene una caché en memoria de 30 segundos por tag y traduce errores de autenticación, tags inválidos, jugador no encontrado, límite de peticiones y fallos de conexión. Configura `ALLOWED_ORIGIN` con el origen exacto de la web o `ALLOWED_ORIGINS` con varios separados por comas; el valor por defecto solo habilita los orígenes locales `localhost:3000`, `localhost:8000` y `127.0.0.1:8000`. Abrir `index.html` como `file://` no es compatible con CORS: sirve la página por HTTP. El alojamiento estático de GitHub Pages no sirve `server.js`; para producción, aloja el proxy por separado y añade el dominio de la página a `ALLOWED_ORIGINS`.

## Verificación

Ejecuta `npm test` para comprobar validación de tags, estructuras de batalla, datos incompletos y detección del jugador estelar. Las pruebas usan fixtures estructurales; no sustituyen una consulta real. Para confirmar datos reales hace falta una clave privada válida y un tag de jugador.

## Bracket y detalles de partido

El bracket mezcla al azar a los equipos al preparar la primera ronda. Si el total no es potencia de dos, algunos pasan directamente para completar el cuadro. Cada resultado habilita la ronda siguiente; al completar las semifinales se crean la final y el partido por el bronce. Al pulsar un cruce se abre su ficha con los equipos, los jugadores, brawlers, modo, mapa y jugador estelar encontrados en el historial.

La API oficial ofrece el historial de batalla de cada tag, no las selecciones en directo de una partida futura. Por eso, los brawlers, el modo y el estelar aparecen cuando Brawl Stars ya ha registrado una batalla en la que coinciden participantes de ambos equipos. La ficha indica cuando aún no existe esa coincidencia.
