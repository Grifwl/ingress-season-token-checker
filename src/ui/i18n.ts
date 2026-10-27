import type { LocalizedText } from "../series/types";

/**
 * Interface translations.
 *
 * English is the default; Spanish is chosen automatically when the browser
 * prefers it (or a language usually read by Spanish speakers in Spain, such
 * as Catalan), and the visitor can switch manually. The choice is remembered
 * per browser.
 *
 * Messages are functions so that every parameter is typed and every
 * language is forced to provide every message. Parameters arrive already
 * formatted (numbers with the right separators, HTML-escaped names...), and
 * some messages return HTML with emphasis on the key figures.
 */

/** Supported interface languages. */
export type Lang = "en" | "es";

/** Languages offered in the language picker, with their own names. */
export const LANGUAGES: { code: Lang; name: string }[] = [
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
];

const STORAGE_KEY = "season-token-checker:lang";

/** Current language. */
let current: Lang = detectLanguage();

/**
 * Pick the initial language: the saved choice if any, otherwise the first
 * supported language in the browser preferences, otherwise English.
 *
 * @returns Detected language.
 */
function detectLanguage(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "es") return saved;
  } catch {
    // Storage unavailable: fall through to browser preferences.
  }
  const prefs = typeof navigator !== "undefined" ? navigator.languages ?? [navigator.language] : [];
  for (const tag of prefs) {
    const base = tag.toLowerCase().split("-")[0];
    if (base === "en") return "en";
    // Languages of Spain other than Spanish: Spanish is closer than English.
    if (base === "es" || base === "ca" || base === "gl" || base === "eu") return "es";
  }
  return "en";
}

/**
 * Current interface language.
 *
 * @returns Language code.
 */
export function getLang(): Lang {
  return current;
}

/**
 * Change and remember the interface language.
 *
 * @param lang - New language.
 */
export function setLang(lang: Lang): void {
  current = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Ignored: the choice just will not be remembered.
  }
}

/**
 * BCP 47 locale used for number and date formatting.
 *
 * @returns e.g. "en-GB" or "es-ES".
 */
export function locale(): string {
  return current === "es" ? "es-ES" : "en-GB";
}

/**
 * Resolve a config text in the current language.
 *
 * @param text - Plain or localized text.
 * @returns The translation, falling back to English.
 */
export function tx(text: LocalizedText): string {
  return typeof text === "string" ? text : text[current] ?? text.en;
}

/**
 * Choose singular or plural.
 *
 * @param n - Count.
 * @param one - Singular form.
 * @param many - Plural form.
 */
const pl = (n: number, one: string, many: string) => (n === 1 ? one : many);

const en = {
  pageTitle: (series: string) => `${series} token forecast`,
  indexTitle: "Ingress season token forecast",
  indexIntro: "Find out which season medal you are heading for, and what it takes to reach the next one.",
  allSeries: "Ingress seasons",
  notFoundTitle: "Series not found",
  notFound: (slug: string) => `There is no forecast for “${slug}”.`,
  seeAllSeries: "See every series",
  officialAnnouncement: "official announcement",
  language: "Language",

  yourStatus: "Your status",
  date: "Date",
  currentTokens: (tokenName: string) => `Current ${tokenName}`,
  bountiesToday: "Daily bounties done today",
  bountiesOption: (n: number, tokens: string) => `${n} (${tokens} tokens)`,
  bountiesOptionPaid: (n: number, tokens: string) => `${n} (${tokens} tokens, paid)`,

  tokenSources: "Token sources",
  dailyBounties: "Daily Research Bounties",
  dailyBountiesInfo: (relaxed: number) =>
    `Every day of the season. The first ${relaxed} are usually doable from home; ` +
    "the forecast calls that a <em>relaxed</em> day.",
  paidBountiesInfo: (from: number, to: number, packs: string) =>
    `Bounties ${from}–${to} have to be unlocked with CMU: ${packs}.`,
  unlockPack: (days: number, cmu: string) => `${days} ${pl(days, "day", "days")} for ${cmu} CMU`,
  bountiesColumn: "Bounties",
  tokensPerDayColumn: "Tokens / day",
  freeBountiesTitle: "Free",
  paidBountiesTitle: "Paid",
  cost: (cmu: string, eur: string, eurCore: string | null, subs: number, subsEur: string) =>
    `≈ ${cmu} CMU: ${eur}, or ${eurCore === null ? "no extra cost" : eurCore} with C.O.R.E. ` +
    `(using the CMU of ${subs} ${pl(subs, "subscription", "subscriptions")}, ${subsEur})`,

  phaseUpcoming: "Upcoming",
  phaseActive: "In progress",
  phasePast: "Finished",
  inPerson: "In person",
  remote: "Remote",
  upTo: (dates: string, max: string) => `${dates} · up to ${max} tokens`,
  yourPlan: "Your plan",
  intentYes: "I'll do it",
  intentMaybe: "Not sure",
  intentNo: "I won't",
  gotTokens: "I got these tokens",
  attendedPending: "I attended; tokens not received yet",
  bountiesDone: (k: number, n: number) => `${k} of ${n} bounties`,
  bountiesDoneClosed: (k: number, n: number) => `${k} of ${n} bounties · assignment closed`,
  closedAssignment: "Closed: the missing bounties can no longer be done.",
  detailedAssignment: (bounties: string, reward: string, required: number, n: number) =>
    `${bounties} + ${reward} on completing ${required} of ${n}`,
  opaqueAssignment: (total: string) => `${total} in total`,
  noBountyDetails: "Per-bounty details not available.",
  lockedAssignment: "Locked until the previous assignment is completed.",
  notStarted: "Not started",
  inProgress: "In progress",
  completed: "Completed",
  pendingAssignments: "Assignments still to complete",
  pendingAssignmentsHint: "How you plan to finish the assignments you have not completed yet.",
  planFull: "Every bounty (maximum tokens)",
  planMinimum: "Only the bounties required to complete them",
  earnedAtLeast: "Tokens earned so far (at least)",
  earnedAtMost: "…and at most",
  earnedSummary: (x: string) => `Earned ${x}`,
  toEarnSummary: (x: string) => `+${x} to earn`,
  availableSummary: (x: string) => `${x} still available`,
  lostSummary: (x: string) => `${x} lost`,
  bonusReceived: (bonus: string) => `${bonus}: received`,
  bonusTokens: "Bonus tokens received",
  bonusSummary: (x: string) => `+${x} bonus`,

  forecast: "Forecast",
  warnEventsExceed:
    "The event tokens you declared add up to more than your current total. " +
    "Check your current tokens and your event progress.",
  warnUnexplained: (dailyMax: string) =>
    `Your total is higher than daily bounties (max ${dailyMax}/day, paid ones included) and your declared ` +
    "events can explain. You may have forgotten to declare an event.",
  warnPaidBounties: (days: number) =>
    `Your total is only possible if you unlocked the paid daily bounties on at least ${days} ` +
    `${pl(days, "day", "days")} (or if you forgot to declare an event).`,
  costNote:
    "Costs are the cheapest combination of purchases within the dates involved, ignoring CMU you already had. " +
    "With C.O.R.E., the CMU included in the monthly subscription (one per month) are free, since you pay " +
    "it anyway; only the extra CMU are counted, and the subscriptions used are shown apart.",
  daysElapsed: "Days elapsed",
  daysOf: (e: number, t: number) => `${e} of ${t}`,
  daysLeftAfterToday: (n: number) => `${n} ${pl(n, "day", "days")} left after today`,
  season: "Season",
  notStartedSeason: "Not started",
  daysInTotal: (n: number) => `${n} days in total`,
  finished: "Finished",
  eventTokensEarned: "Event tokens earned",
  pastBountyTokens: "Daily bounty tokens before today",
  yourPace: "Your pace",
  perDay: (x: string) => `${x} / day`,
  paceBounties: (x: string) => `≈ ${x} bounties a day`,
  committedToCome: "Committed event tokens to come",
  committedHint: "events marked “I'll do it”",
  projectedTotal: "Projected final total",
  noMedal: "No medal",

  alreadyUnlocked: "✔ Already unlocked.",
  paceYes: "✔ You get there at your current pace with the events you committed to.",
  paceMaybe: (projection: string) =>
    `≈ At your current pace you end at ${projection}: you only get there in the best case.`,
  paceNo: (symbol: string, projection: string, missing: string) =>
    `${symbol} At your current pace you end at ${projection}, <strong>${missing} short</strong>.`,
  bountyDaysPrefix: "With daily bounties alone you get there",
  bountyDaysIn: (days: number, n: number) =>
    `in <strong>${days} ${pl(days, "day", "days")}</strong> with ${n} a day`,
  bountyDaysNever: (n: number) => `not before the season ends with ${n} a day`,
  planRelaxedEnough: (relaxed: number, tokens: string) =>
    `${relaxed} bounties a day (${tokens} tokens) are enough`,
  planFullDays: (all: number, days: number, relaxed: number, otherDays: number) =>
    `do all ${all} bounties on <strong>${days} ${pl(days, "day", "days")}</strong>; ` +
    `${relaxed} are enough on the other ${otherDays} ${pl(otherDays, "day", "days")}`,
  planShort: (all: number, shortfall: string) =>
    `even with ${all} bounties every day you are ${shortfall} tokens short`,
  planPaidDays: (days: number) =>
    `; unlocking the paid bounties on <strong>${days} ${pl(days, "day", "days")}</strong> closes the gap`,
  planPaidShort: (shortfall: string) =>
    `; not even unlocking the paid bounties every day is enough (${shortfall} tokens short)`,
  bestCase: (text: string) => ` (best case: ${text})`,
  withCommitted: (text: string) => `With the events you committed to, ${text}.`,
  inPersonPrefix: (n: number, cost: string) =>
    `With ${n} bounties a day${cost} and every remote event you have not ruled out completed,`,
  inPersonImpossible: "not reachable even attending every remaining in-person event.",
  inPersonNone: "no in-person event is needed.",
  inPersonNeeded: (list: string) => `attend at least ${list}.`,
  and: " and ",
  notDecided: "Not decided yet",
};

/** Shape every language must implement. */
export type Messages = typeof en;

const es: Messages = {
  pageTitle: (series) => `Previsión de tokens de ${series}`,
  indexTitle: "Previsión de tokens de temporada de Ingress",
  indexIntro: "Descubre a qué medalla de temporada te diriges y qué necesitas para llegar a la siguiente.",
  allSeries: "Temporadas de Ingress",
  notFoundTitle: "Serie no encontrada",
  notFound: (slug) => `No hay previsión para «${slug}».`,
  seeAllSeries: "Ver todas las series",
  officialAnnouncement: "anuncio oficial",
  language: "Idioma",

  yourStatus: "Tu situación",
  date: "Fecha",
  currentTokens: (tokenName) => `${tokenName} actuales`,
  bountiesToday: "Bounties diarios hechos hoy",
  bountiesOption: (n, tokens) => `${n} (${tokens} tokens)`,
  bountiesOptionPaid: (n, tokens) => `${n} (${tokens} tokens, de pago)`,

  tokenSources: "Fuentes de tokens",
  dailyBounties: "Bounties diarios de investigación",
  dailyBountiesInfo: (relaxed) =>
    `Todos los días de la temporada. Los ${relaxed} primeros se suelen poder hacer desde casa; ` +
    "la previsión lo llama un día <em>relajado</em>.",
  paidBountiesInfo: (from, to, packs) => `Los bounties ${from}–${to} se desbloquean con CMU: ${packs}.`,
  unlockPack: (days, cmu) => `${days} ${pl(days, "día", "días")} por ${cmu} CMU`,
  bountiesColumn: "Bounties",
  tokensPerDayColumn: "Tokens / día",
  freeBountiesTitle: "Gratuitos",
  paidBountiesTitle: "De pago",
  cost: (cmu, eur, eurCore, subs, subsEur) =>
    `≈ ${cmu} CMU: ${eur}, o ${eurCore === null ? "sin coste adicional" : eurCore} con C.O.R.E. ` +
    `(usando los CMU de ${subs} ${pl(subs, "suscripción", "suscripciones")}, ${subsEur})`,

  phaseUpcoming: "Próximamente",
  phaseActive: "En curso",
  phasePast: "Terminado",
  inPerson: "Presencial",
  remote: "En remoto",
  upTo: (dates, max) => `${dates} · hasta ${max} tokens`,
  yourPlan: "Tu plan",
  intentYes: "Lo haré",
  intentMaybe: "No lo sé",
  intentNo: "No lo haré",
  gotTokens: "Ya tengo estos tokens",
  attendedPending: "Asistí; aún no he recibido los tokens",
  bountiesDone: (k, n) => `${k} de ${n} bounties`,
  bountiesDoneClosed: (k, n) => `${k} de ${n} bounties · asignación cerrada`,
  closedAssignment: "Cerrada: los bounties que faltaban ya no se pueden hacer.",
  detailedAssignment: (bounties, reward, required, n) =>
    `${bounties} + ${reward} al completar ${required} de ${n}`,
  opaqueAssignment: (total) => `${total} en total`,
  noBountyDetails: "Falta el detalle de cada bounty.",
  lockedAssignment: "Bloqueada hasta completar la asignación anterior.",
  notStarted: "Sin empezar",
  inProgress: "En curso",
  completed: "Completada",
  pendingAssignments: "Asignaciones pendientes",
  pendingAssignmentsHint: "Cómo piensas terminar las asignaciones que aún no has completado.",
  planFull: "Todos los bounties (máximo de tokens)",
  planMinimum: "Solo los bounties necesarios para completarlas",
  earnedAtLeast: "Tokens obtenidos hasta ahora (como mínimo)",
  earnedAtMost: "…y como máximo",
  earnedSummary: (x) => `Obtenidos ${x}`,
  toEarnSummary: (x) => `+${x} por obtener`,
  availableSummary: (x) => `${x} aún disponibles`,
  lostSummary: (x) => `${x} perdidos`,
  bonusReceived: (bonus) => `${bonus}: recibido`,
  bonusTokens: "Tokens extra recibidos",
  bonusSummary: (x) => `+${x} de bonus`,

  forecast: "Previsión",
  warnEventsExceed:
    "Los tokens de eventos que has indicado suman más que tu total actual. " +
    "Revisa tus tokens actuales y tu progreso en los eventos.",
  warnUnexplained: (dailyMax) =>
    `Tu total es mayor de lo que explican los bounties diarios (máx. ${dailyMax}/día, contando los de pago) ` +
    "y los eventos indicados. Puede que te hayas olvidado de indicar algún evento.",
  warnPaidBounties: (days) =>
    `Tu total solo es posible si has desbloqueado los bounties diarios de pago como mínimo ${days} ` +
    `${pl(days, "día", "días")} (o si te has olvidado de indicar algún evento).`,
  costNote:
    "Los costes son la combinación de compras más barata dentro de las fechas implicadas, sin contar los CMU " +
    "que ya tuvieras. Con C.O.R.E., los CMU incluidos en la suscripción mensual (una al mes) son gratis, " +
    "ya que la pagas igualmente; solo se cuentan los CMU adicionales, y las suscripciones usadas se indican aparte.",
  daysElapsed: "Días transcurridos",
  daysOf: (e, t) => `${e} de ${t}`,
  daysLeftAfterToday: (n) => `${pl(n, "queda", "quedan")} ${n} ${pl(n, "día", "días")} después de hoy`,
  season: "Temporada",
  notStartedSeason: "Sin empezar",
  daysInTotal: (n) => `${n} días en total`,
  finished: "Terminada",
  eventTokensEarned: "Tokens de eventos obtenidos",
  pastBountyTokens: "Tokens de bounties diarios antes de hoy",
  yourPace: "Tu ritmo",
  perDay: (x) => `${x} / día`,
  paceBounties: (x) => `≈ ${x} bounties al día`,
  committedToCome: "Tokens de eventos comprometidos",
  committedHint: "eventos marcados como «Lo haré»",
  projectedTotal: "Total final previsto",
  noMedal: "Sin medalla",

  alreadyUnlocked: "✔ Ya desbloqueada.",
  paceYes: "✔ Llegas con tu ritmo actual y los eventos a los que te has comprometido.",
  paceMaybe: (projection) =>
    `≈ A tu ritmo actual acabas con ${projection}: solo llegas en el mejor caso.`,
  paceNo: (symbol, projection, missing) =>
    `${symbol} A tu ritmo actual acabas con ${projection}; <strong>te faltan ${missing}</strong>.`,
  bountyDaysPrefix: "Solo con bounties diarios llegas",
  bountyDaysIn: (days, n) => `en <strong>${days} ${pl(days, "día", "días")}</strong> con ${n} al día`,
  bountyDaysNever: (n) => `no antes de que acabe la temporada con ${n} al día`,
  planRelaxedEnough: (relaxed, tokens) => `basta con ${relaxed} bounties al día (${tokens} tokens)`,
  planFullDays: (all, days, relaxed, otherDays) =>
    `haz los ${all} bounties <strong>${days} ${pl(days, "día", "días")}</strong>; ` +
    `${pl(otherDays, "el otro día", `los otros ${otherDays} días`)} basta con ${relaxed}`,
  planShort: (all, shortfall) => `incluso con ${all} bounties cada día te faltan ${shortfall} tokens`,
  planPaidDays: (days) =>
    `; desbloqueando los bounties de pago <strong>${days} ${pl(days, "día", "días")}</strong> llegas`,
  planPaidShort: (shortfall) =>
    `; ni desbloqueando los bounties de pago cada día llegas (te faltan ${shortfall} tokens)`,
  bestCase: (text) => ` (en el mejor caso: ${text})`,
  withCommitted: (text) => `Con los eventos a los que te has comprometido, ${text}.`,
  inPersonPrefix: (n, cost) =>
    `Con ${n} bounties al día${cost} y completando todos los eventos en remoto que no hayas descartado,`,
  inPersonImpossible: "no llegas ni asistiendo a todos los eventos presenciales que quedan.",
  inPersonNone: "no necesitas ningún evento presencial.",
  inPersonNeeded: (list) => `tienes que asistir como mínimo a ${list}.`,
  and: " y ",
  notDecided: "Sin decidir",
};

const messages: Record<Lang, Messages> = { en, es };

/**
 * Messages of the current language.
 *
 * @returns The message table.
 */
export function m(): Messages {
  return messages[current];
}
