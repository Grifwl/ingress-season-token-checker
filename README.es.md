# Ingress Season Token Checker

**Idiomas:** [English](README.md) · Español

Una página web que prevé a qué medalla de temporada de Ingress llegarás y
qué necesitas para alcanzar la siguiente. Funciona en
[season.grifwl.blue](https://season.grifwl.blue), con una página por
temporada (por ejemplo [`/cygnus`](https://season.grifwl.blue/cygnus)).

## Qué hace

Tú indicas:

- tus tokens de temporada actuales y cuántos bounties diarios has hecho hoy;
- para cada fuente de tokens (First Saturdays, Shard Storms, campañas de
  Dispatch, campañas globales…), si ya has obtenido sus tokens, tu progreso
  y si piensas participar en lo que queda.

La página:

1. resta de tu total los tokens de eventos ya obtenidos, para saber cuántos
   tokens vienen de los bounties diarios;
2. lo convierte en tu ritmo medio diario;
3. proyecta tu total final si mantienes ese ritmo y haces los eventos a los
   que te has comprometido;
4. para cada nivel de medalla que aún no tienes, te dice si tu ritmo basta.
   Si no basta, te dice cuántos días tienes que hacer todos los bounties
   diarios y a qué eventos presenciales tendrías que asistir.

Algunas fuentes de tokens solo están documentadas en parte (por ejemplo, una
campaña de la que no se ha publicado el detalle de cada bounty). El motor
trata cada cifra incierta como un rango `[mín, máx]`, así que los resultados
muestran el peor y el mejor caso. Se van estrechando a medida que se afina la
configuración de la serie.

Tus respuestas solo se guardan en tu propio navegador (`localStorage`).

La interfaz está disponible en inglés (por defecto) y en castellano. Sigue el
idioma del navegador y se puede cambiar desde la cabecera.

## Añadir una nueva serie

Todo lo específico de una temporada está en un único archivo de
configuración:

1. Copia `src/series/cygnus.ts` a `src/series/<nombre>.ts` y actualiza:
   - las fechas y los umbrales de medalla (cualquier número de niveles);
   - las recompensas de los bounties diarios (`dailyBounties`);
   - los eventos y sus tokens. Hay tres tipos:
     - `fixed`: todo o nada, por ejemplo el check-in de un First Saturday.
       Indica `tokensGrantedLater` cuando los tokens llegan un tiempo
       después del evento: los agentes pueden marcar que asistieron, y la
       previsión cuenta esos tokens como pendientes hasta recibirlos;
     - `campaign`: campañas de Dispatch con estructura de asignaciones
       conocida. Las asignaciones pueden ser *detalladas* (bounties +
       recompensa + número necesario) u *opacas* (solo se conoce el total;
       la página indica que falta el detalle de cada bounty);
     - `open`: solo se conoce el máximo; los agentes indican lo que han
       obtenido.

   Cualquier evento puede declarar además un `bonus`: una recompensa extra
   de cantidad desconocida que solo reciben algunos agentes (por ejemplo,
   un bonus por clasificación). La previsión nunca cuenta con él; cuando
   el evento termina, los agentes pueden indicar si lo han recibido y
   cuántos tokens les ha dado.

   Los textos que ve el usuario (nombres, notas, etiquetas) pueden ser una
   cadena simple o un mapa de traducciones `{ en, es }`.
2. Regístrala en `src/series/index.ts`.
3. Ejecuta `npm test`. Comprueba la coherencia de todas las configuraciones.

La serie se sirve entonces en `/<id>`.

## Desarrollo

Requiere Node.js 20 o posterior.

```sh
npm install
npm run dev      # servidor local de desarrollo
npm test         # tests unitarios
npm run build    # comprobación de tipos y build en dist/
```

## Despliegue

La web es un build estático servido por un Cloudflare Worker con assets
estáticos (ver `wrangler.jsonc`). Está vinculada al dominio propio
`season.grifwl.blue`.

```sh
npx wrangler login   # una vez
npm run deploy
```

## Estructura del proyecto

```
src/
  series/      configuraciones de temporada y sus tipos
  engine/      lógica de previsión (sin DOM; reutilizable, p. ej. por un bot)
  ui/          renderizado, traducciones, formato y almacenamiento
  main.ts      router
tests/         tests unitarios del motor y de las configuraciones
```
