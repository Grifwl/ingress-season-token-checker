import { tokensForBounties } from "../engine/bounties";
import { todayIso, isIsoDate } from "../engine/dates";
import {
  canAwaitTokens,
  canCloseEarly,
  enforceAssignmentOrder,
  enforceClosedAssignments,
  evaluateEvent,
  eventMaxTokens,
  firstLockedAssignment,
  isDetailed,
  type EventEvaluation,
} from "../engine/events";
import {
  forecast,
  type BountyDays,
  type BountyPlan,
  type Forecast,
  type ForecastWarning,
  type InPersonPlan,
  type TierAnalysis,
} from "../engine/forecast";
import type { PaidDaysCost } from "../engine/pricing";
import type { Range } from "../engine/range";
import { normalizeState, type EventState, type UserState } from "../engine/state";
import type { Assignment, EventConfig, MedalTier, SeriesConfig } from "../series/types";
import { esc, fmt, fmtDates, fmtEur, fmtRange } from "./format";
import { getLang, LANGUAGES, m, setLang, tx, type Lang } from "./i18n";
import { loadState, saveState } from "./storage";

/**
 * Render a medal tier's name, coloured after its metal when it has one.
 *
 * @param md - Medal tier.
 * @returns Escaped HTML.
 */
function medalName(md: MedalTier): string {
  const name = esc(tx(md.name));
  return md.metal ? `<span class="metal metal-${md.metal}">${name}</span>` : name;
}

/**
 * Interactive forecast page for one series.
 *
 * Responsibilities:
 * - render the input form (current tokens, today's bounties, every event);
 * - keep the agent's answers in memory and in browser storage;
 * - recompute and render the forecast after every change.
 *
 * The form is rendered once and only re-rendered when the forecast date or
 * the language changes (the date changes which controls each event needs).
 * Every other edit only refreshes the results and the per-event summaries,
 * so inputs never lose focus while typing.
 */
export class SeriesPage {
  private readonly config: SeriesConfig;
  private readonly root: HTMLElement;
  private state: UserState;
  /** Forecast date. Not persisted: a revisit should always use today. */
  private today: string;

  /**
   * @param root - Element the page is rendered into.
   * @param config - Series to forecast.
   */
  constructor(root: HTMLElement, config: SeriesConfig) {
    this.root = root;
    this.config = config;
    this.state = normalizeState(config, loadState(config.id));
    this.today = todayIso();
    this.root.addEventListener("input", (e) => this.onEdit(e, false));
    this.root.addEventListener("change", (e) => this.onEdit(e, true));
    this.render();
  }

  /** Render the whole page and fill in the results. */
  private render(): void {
    const c = this.config;
    const t = m();
    document.title = t.pageTitle(c.name);
    document.documentElement.lang = getLang();
    const bountyCounts = c.dailyBounties.bountyTokens.map((_, i) => i + 1);

    this.root.innerHTML = `
      <header class="page-header">
        <div class="top-bar">
          <a href="/">${esc(t.allSeries)}</a>
          ${languagePicker()}
        </div>
        <h1>${esc(t.pageTitle(c.name))}</h1>
        <p class="muted">${fmtDates(c.startDate, c.endDate)} ${c.startDate.slice(0, 4)} ·
          <a href="${esc(c.infoUrl)}" target="_blank" rel="noopener">${esc(t.officialAnnouncement)}</a></p>
        <ul class="medals">
          ${c.medals.map((md) => `<li><strong>${medalName(md)}</strong> ${fmt(md.tokens)}</li>`).join("")}
        </ul>
      </header>

      <div class="layout">
        <section class="card area-status">
          <h2>${esc(t.yourStatus)}</h2>
          <div class="fields">
            <label>${esc(t.date)}
              <input type="date" data-field="today" value="${this.today}">
            </label>
            <label>${esc(t.currentTokens(tx(c.tokenName)))}
              <input type="number" inputmode="numeric" min="0" step="10" data-field="currentTokens"
                value="${this.state.currentTokens || ""}" placeholder="0">
            </label>
            <label>${esc(t.bountiesToday)}
              <select data-field="bountiesToday">
                ${[0, ...bountyCounts]
                  .map((n) => {
                    const tokens = fmt(tokensForBounties(c.dailyBounties, n));
                    const label = n > c.dailyBounties.freeCount ? t.bountiesOptionPaid(n, tokens) : t.bountiesOption(n, tokens);
                    return option(String(n), label, this.state.bountiesToday === n);
                  })
                  .join("")}
              </select>
            </label>
          </div>
        </section>

        <section class="card area-sources">
          <h2>${esc(t.tokenSources)}</h2>
          ${this.renderDailyBounties()}
          ${c.categories.map((cat) => this.renderCategory(cat.id, tx(cat.pluralLabel))).join("")}
        </section>

        <aside class="card area-results" id="results" aria-live="polite"></aside>
      </div>
    `;
    this.updateResults();
  }

  /** Explain how daily bounties are rewarded, and what the paid ones cost. */
  private renderDailyBounties(): string {
    const t = m();
    const b = this.config.dailyBounties;
    const all = b.bountyTokens.length;
    /**
     * One table of bounty counts and their daily tokens. Free and paid
     * bounties get a table each, side by side, so the list stays short.
     */
    const table = (counts: number[], caption: string | null) => `
      <table class="mini">
        ${caption ? `<caption>${esc(caption)}</caption>` : ""}
        <thead><tr><th>${esc(t.bountiesColumn)}</th><th>${esc(t.tokensPerDayColumn)}</th></tr></thead>
        <tbody>${counts.map((n) => `<tr><td>${n}</td><td>${fmt(tokensForBounties(b, n))}</td></tr>`).join("")}</tbody>
      </table>`;
    const counts = b.bountyTokens.map((_, i) => i + 1);
    const free = counts.filter((n) => n <= b.freeCount);
    const paid = counts.filter((n) => n > b.freeCount);
    const tables = paid.length
      ? `<div class="bounty-tables">${table(free, t.freeBountiesTitle)}${table(paid, t.paidBountiesTitle)}</div>`
      : table(free, null);
    // Unlock prices are listed only when the series has paid bounties.
    const pricing = b.unlockPricing;
    const paidInfo =
      b.freeCount < all && pricing
        ? `<p class="muted">${esc(
            t.paidBountiesInfo(b.freeCount + 1, all, pricing.packs.map((p) => t.unlockPack(p.days, fmt(p.cmu))).join(" · ")),
          )}</p>
          <p class="note">${esc(t.costNote)}</p>`
        : "";
    return `
      <div class="source">
        <h3>${esc(t.dailyBounties)}</h3>
        <p class="muted">${t.dailyBountiesInfo(b.relaxedCount)}</p>
        ${paidInfo}
        ${tables}
      </div>`;
  }

  /**
   * Render every event of a category.
   *
   * @param categoryId - Category to render.
   * @param title - Heading.
   */
  private renderCategory(categoryId: string, title: string): string {
    const events = this.config.events.filter((e) => e.category === categoryId);
    if (!events.length) return "";
    return `<div class="source"><h3>${esc(title)}</h3>${events.map((e) => this.renderEvent(e)).join("")}</div>`;
  }

  /**
   * Render one event with the controls its phase needs. Every control is a
   * row with the label on the left and the input on the right, so all the
   * selects of an event line up.
   *
   * @param event - Event config.
   */
  private renderEvent(event: EventConfig): string {
    const t = m();
    const st = this.state.events[event.id]!;
    const ev = evaluateEvent(event, st, this.today);
    const id = esc(event.id);
    const rows: string[] = [];

    if (ev.phase !== "past") {
      rows.push(
        row(
          `<span class="row-title">${esc(t.yourPlan)}</span>`,
          `<select data-event="${id}" data-prop="intent">
            ${option("yes", t.intentYes, st.intent === "yes")}
            ${option("maybe", t.intentMaybe, st.intent === "maybe")}
            ${option("no", t.intentNo, st.intent === "no")}
          </select>`,
        ),
      );
    }

    // Events whose tokens arrive later can be marked as attended, so the
    // forecast keeps counting on them until they are received. The option
    // disappears once the tokens are checked, since it no longer matters.
    if (canAwaitTokens(event) && ev.phase !== "upcoming" && !st.completed) {
      rows.push(`
        <label class="row row-check">
          <input type="checkbox" data-event="${id}" data-prop="attended" ${st.attended ? "checked" : ""}>
          ${esc(t.attendedPending)}
        </label>`);
    }

    if (event.kind === "fixed" && ev.phase !== "upcoming") {
      rows.push(`
        <label class="row row-check">
          <input type="checkbox" data-event="${id}" data-prop="completed" ${st.completed ? "checked" : ""}>
          ${esc(t.gotTokens)}
        </label>`);
    }

    if (event.kind === "campaign") {
      if (ev.phase !== "upcoming") {
        const locked = firstLockedAssignment(event.assignments, st.assignments);
        rows.push(
          ...event.assignments.map((a, i) =>
            this.renderAssignment(id, a, i, st.assignments[i] ?? 0, i >= locked, {
              closed: st.closedAssignments[i] === true,
              nextStarted: (st.assignments[i + 1] ?? 0) > 0,
            }),
          ),
        );
      }
      // Only meaningful when skipping a bounty is possible (e.g. 3 of 4).
      const canSkip = event.assignments.some((a) => isDetailed(a) && a.required < a.bounties.length);
      if (ev.phase !== "past" && canSkip) {
        rows.push(
          row(
            `<span class="row-title">${esc(t.pendingAssignments)}</span>
             <small class="muted">${esc(t.pendingAssignmentsHint)}</small>`,
            `<select data-event="${id}" data-prop="plan">
              ${option("full", t.planFull, st.plan === "full")}
              ${option("minimum", t.planMinimum, st.plan === "minimum")}
            </select>`,
          ),
        );
      }
    }

    if (event.kind === "open" && ev.phase !== "upcoming") {
      rows.push(
        row(
          `<span class="row-title">${esc(t.earnedAtLeast)}</span>`,
          `<input type="number" inputmode="numeric" min="0" step="10" data-event="${id}" data-prop="earnedMin"
            value="${st.earnedMin || ""}" placeholder="0">`,
        ),
        row(
          `<span class="row-title">${esc(t.earnedAtMost)}</span>`,
          `<input type="number" inputmode="numeric" min="0" step="10" data-event="${id}" data-prop="earnedMax"
            value="${st.earnedMax || ""}" placeholder="=">`,
        ),
      );
    }

    // The bonus is only granted after the event, so it can only be declared
    // once the event is over; until then its note just explains it.
    if (event.bonus && ev.phase === "past") {
      rows.push(`
        <label class="row row-check">
          <input type="checkbox" data-event="${id}" data-prop="bonusReceived" ${st.bonusReceived ? "checked" : ""}>
          ${esc(t.bonusReceived(tx(event.bonus.name)))}
        </label>`);
      if (st.bonusReceived) {
        rows.push(
          row(
            `<span class="row-title">${esc(t.bonusTokens)}</span>`,
            `<input type="number" inputmode="numeric" min="0" step="10" data-event="${id}" data-prop="bonusTokens"
              value="${st.bonusTokens || ""}" placeholder="0">`,
          ),
        );
      }
    }

    const phaseLabel = { upcoming: t.phaseUpcoming, active: t.phaseActive, past: t.phasePast }[ev.phase];
    const name = esc(tx(event.name));
    return `
      <article class="event phase-${ev.phase}">
        <div class="event-head">
          <h4>${event.infoUrl ? `<a href="${esc(event.infoUrl)}" target="_blank" rel="noopener">${name}</a>` : name}</h4>
          <span class="badge badge-${ev.phase}">${esc(phaseLabel)}</span>
          <span class="badge ${event.inPerson ? "badge-inperson" : ""}">${esc(event.inPerson ? t.inPerson : t.remote)}</span>
        </div>
        <p class="muted">${esc(t.upTo(fmtDates(event.startDate, event.endDate), fmt(eventMaxTokens(event))))}</p>
        ${event.notes ? `<p class="note">${esc(tx(event.notes))}</p>` : ""}
        ${event.bonus ? `<p class="note"><strong>${esc(tx(event.bonus.name))}:</strong> ${esc(tx(event.bonus.note))}</p>` : ""}
        <div class="rows">${rows.join("")}</div>
        <p class="event-summary" data-summary="${id}"></p>
      </article>`;
  }

  /**
   * Render the progress row of one campaign assignment.
   *
   * @param eventId - Escaped event id.
   * @param a - Assignment config.
   * @param index - Position in the campaign.
   * @param progress - Stored progress value.
   * @param locked - Whether the previous assignment is not completed yet.
   * @param closing - Whether the assignment is closed, and whether the next
   *   one is started (which forces it closed).
   */
  private renderAssignment(
    eventId: string,
    a: Assignment,
    index: number,
    progress: number,
    locked: boolean,
    closing: { closed: boolean; nextStarted: boolean },
  ): string {
    const t = m();
    let detail: string;
    let options: string;
    if (isDetailed(a)) {
      detail = t.detailedAssignment(a.bounties.map(fmt).join(" + "), fmt(a.reward), a.required, a.bounties.length);
      // A completed assignment with bounties still undone gets a second
      // option to say it was closed (its reward claimed), which forfeits
      // the missing bounties. Once the next assignment is started it must
      // have been closed, so the open option is no longer offered.
      options = Array.from({ length: a.bounties.length + 1 }, (_, n) => {
        const value = String(n);
        const done = t.bountiesDone(n, a.bounties.length);
        if (!canCloseEarly(a, n)) return option(value, done, progress === n);
        const isCurrent = progress === n;
        return [
          closing.nextStarted ? "" : option(value, done, isCurrent && !closing.closed),
          option(`${value}c`, t.bountiesDoneClosed(n, a.bounties.length), isCurrent && closing.closed),
        ].join("");
      }).join("");
    } else {
      detail = t.opaqueAssignment(fmt(a.total));
      options = [
        option("0", t.notStarted, progress === 0),
        option("1", t.inProgress, progress === 1),
        option("2", t.completed, progress === 2),
      ].join("");
    }
    // Opaque assignments are always flagged, so nobody mistakes the coarse
    // "in progress" estimate for a precise figure.
    const note = a.note ? tx(a.note) : isDetailed(a) ? "" : t.noBountyDetails;
    return row(
      `<span class="row-title">${esc(tx(a.name))}</span>
       <small class="muted">${esc(detail)}</small>
       ${note ? `<small class="note">${esc(note)}</small>` : ""}
       ${locked ? `<small class="muted">${esc(t.lockedAssignment)}</small>` : ""}
       ${closing.closed ? `<small class="muted">${esc(t.closedAssignment)}</small>` : ""}`,
      `<select data-event="${eventId}" data-prop="assignment" data-index="${index}"${locked ? " disabled" : ""}>${options}</select>`,
    );
  }

  /**
   * Apply an edit from any form control.
   *
   * @param e - DOM input/change event.
   * @param committed - `true` for "change" events (value finished).
   */
  private onEdit(e: Event, committed: boolean): void {
    const target = e.target as HTMLInputElement | HTMLSelectElement;
    const value = target.type === "checkbox" ? (target as HTMLInputElement).checked : target.value;
    const num = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0));

    if (target.dataset.field === "lang") {
      if (committed) {
        setLang(value as Lang);
        this.render();
      }
      return;
    }
    if (target.dataset.field === "today") {
      // Changing the date changes which controls each event shows, so the
      // whole page is re-rendered, but only once the value is final.
      if (committed && isIsoDate(value)) {
        this.today = value;
        this.render();
      }
      return;
    }
    if (target.dataset.field === "currentTokens") this.state.currentTokens = num(value);
    if (target.dataset.field === "bountiesToday") this.state.bountiesToday = num(value);

    const eventId = target.dataset.event;
    if (eventId) {
      const st: EventState = this.state.events[eventId]!;
      switch (target.dataset.prop) {
        case "intent":
          st.intent = value as EventState["intent"];
          break;
        case "completed": {
          st.completed = Boolean(value);
          // Show or hide the "attended" checkbox.
          const event = this.config.events.find((e) => e.id === eventId);
          if (event && canAwaitTokens(event) && committed) this.rerenderEvent(event);
          break;
        }
        case "attended":
          st.attended = Boolean(value);
          break;
        case "plan":
          st.plan = value === "minimum" ? "minimum" : "full";
          break;
        case "assignment": {
          // Values ending in "c" mean the assignment was closed with that
          // many bounties done.
          const index = Number(target.dataset.index);
          st.assignments[index] = num(String(value).replace(/c$/, ""));
          st.closedAssignments[index] = String(value).endsWith("c");
          // Assignments unlock in order: lowering one below its completion
          // threshold clears the later ones, and starting one closes the
          // previous. The card is redrawn so the right selects and options
          // are shown.
          const event = this.config.events.find((e) => e.id === eventId);
          if (event?.kind === "campaign") {
            st.assignments = enforceAssignmentOrder(event.assignments, st.assignments);
            st.closedAssignments = enforceClosedAssignments(event.assignments, st.assignments, st.closedAssignments);
            if (committed) this.rerenderEvent(event);
          }
          break;
        }
        case "earnedMin":
          st.earnedMin = num(value);
          break;
        case "earnedMax":
          st.earnedMax = num(value);
          break;
        case "bonusReceived": {
          st.bonusReceived = Boolean(value);
          // Show or hide the amount input.
          const event = this.config.events.find((e) => e.id === eventId);
          if (event && committed) this.rerenderEvent(event);
          break;
        }
        case "bonusTokens":
          st.bonusTokens = num(value);
          break;
      }
    }
    saveState(this.config.id, this.state);
    this.updateResults();
  }

  /**
   * Replace one event card with a freshly rendered one.
   *
   * @param event - Event to redraw.
   */
  private rerenderEvent(event: EventConfig): void {
    const card = this.root.querySelector(`[data-summary="${CSS.escape(event.id)}"]`)?.closest("article");
    if (card) card.outerHTML = this.renderEvent(event);
  }

  /** Recompute the forecast and refresh the results and event summaries. */
  private updateResults(): void {
    const f = forecast(this.config, this.state, this.today);
    for (const ev of f.evaluations) {
      const el = this.root.querySelector<HTMLElement>(`[data-summary="${CSS.escape(ev.event.id)}"]`);
      if (el) el.innerHTML = eventSummary(ev);
    }
    this.root.querySelector("#results")!.innerHTML = this.renderResults(f);
  }

  /**
   * Render the forecast.
   *
   * @param f - Forecast result.
   */
  private renderResults(f: Forecast): string {
    const t = m();
    const parts: string[] = [`<h2>${esc(t.forecast)}</h2>`];

    if (f.warnings.length) {
      parts.push(`<div class="warnings">${f.warnings.map((w) => `<p>⚠ ${esc(warningText(w))}</p>`).join("")}</div>`);
    }

    // Label, value and an optional sub-line; the sub-line is HTML so medal
    // names in it keep their metal colour.
    const stats: [string, string, string?][] = [];
    if (f.season === "running") {
      stats.push([t.daysElapsed, t.daysOf(f.elapsedDays, f.totalDays), esc(t.daysLeftAfterToday(f.remainingDays))]);
    } else if (f.season === "upcoming") {
      stats.push([t.season, t.notStartedSeason, esc(t.daysInTotal(f.totalDays))]);
    } else {
      stats.push([t.season, t.finished]);
    }
    stats.push([t.eventTokensEarned, fmtRange(f.eventsEarned)]);
    if (f.elapsedDays > 0) stats.push([t.pastBountyTokens, fmtRange(f.pastBountyTokens)]);
    if (f.averagePerDay) {
      stats.push([t.yourPace, t.perDay(fmtRange(f.averagePerDay, true)), esc(this.paceAsBounties(f.averagePerDay))]);
    }
    stats.push([t.committedToCome, fmtRange(f.committedRemaining), esc(t.committedHint)]);
    if (f.projection) stats.push([t.projectedTotal, fmtRange(f.projection), this.tierNames(f.projection)]);

    parts.push(
      `<dl class="stats">${stats
        .map(([k, v, sub]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd>${sub ? `<dd class="muted">${sub}</dd>` : ""}</div>`)
        .join("")}</dl>`,
    );

    if (f.season !== "over") parts.push(f.tiers.map((tier) => this.renderTier(tier, f)).join(""));

    if (f.undecided.length) {
      parts.push(`
        <h3>${esc(t.notDecided)}</h3>
        <ul class="undecided">${f.undecided
          .map((e) => `<li>${esc(tx(e.event.name))} <span class="muted">(${fmtDates(e.event.startDate, e.event.endDate)})</span>: +${fmtRange(e.potential)}</li>`)
          .join("")}</ul>`);
    }
    return parts.join("");
  }

  /**
   * Names of the medal tiers reached at both ends of a total.
   *
   * @param r - Projected total.
   * @returns HTML such as "Gold" or "Silver – Gold", coloured by metal.
   */
  private tierNames(r: Range): string {
    const tier = (v: number) => {
      const reached = [...this.config.medals].reverse().find((md) => v >= md.tokens);
      return reached ? medalName(reached) : esc(m().noMedal);
    };
    return tier(r.min) === tier(r.max) ? tier(r.min) : `${tier(r.min)} – ${tier(r.max)}`;
  }

  /**
   * Describe a daily pace in terms of bounties.
   *
   * @param avg - Average tokens per day.
   * @returns e.g. "≈ 3 bounties a day".
   */
  private paceAsBounties(avg: Range): string {
    const b = this.config.dailyBounties;
    const counts = b.bountyTokens.map((_, i) => i + 1);
    const nearest = (v: number) =>
      counts.reduce(
        (best, n) => (Math.abs(tokensForBounties(b, n) - v) < Math.abs(tokensForBounties(b, best) - v) ? n : best),
        0,
      );
    const lo = nearest(avg.min);
    const hi = nearest(avg.max);
    return m().paceBounties(lo === hi ? String(lo) : `${lo}–${hi}`);
  }

  /**
   * Render the outlook for one tier.
   *
   * @param tier - Tier analysis.
   * @param f - Whole forecast (for context).
   */
  private renderTier(tier: TierAnalysis, f: Forecast): string {
    const t = m();
    const head = `<h3>${medalName(tier.tier)} <span class="muted">(${fmt(tier.tier.tokens)})</span></h3>`;
    if (tier.reached) return `<div class="tier tier-ok">${head}<p>${esc(t.alreadyUnlocked)}</p></div>`;

    const lines: string[] = [];
    let cls = "tier-no";
    if (tier.atPace === "yes") {
      cls = "tier-ok";
      lines.push(esc(t.paceYes));
    } else if (tier.atPace === "maybe" && f.projection) {
      cls = "tier-maybe";
      lines.push(t.paceMaybe(fmtRange(f.projection)));
    } else if (tier.atPace === "no" && f.projection) {
      const missing = { min: tier.tier.tokens - f.projection.max, max: tier.tier.tokens - f.projection.min };
      // The pace falls short, but if extra bounties (free or paid) still get
      // there with the committed events, the tier is not out of reach: it is
      // shown as a warning with a neutral symbol rather than as a failure.
      const plan = tier.bountyPlan.pessimistic;
      const reachable = plan.fullDays !== null || plan.paidDays !== null;
      if (reachable) cls = "tier-maybe";
      lines.push(t.paceNo(reachable ? "→" : "✘", fmtRange(f.projection), fmtRange(missing)));
    } else {
      // No pace yet (season not started or first day): judge the tier by the
      // effort the committed plan requires instead.
      const needed = tier.bountyPlan.pessimistic.fullDays;
      cls = needed === 0 ? "tier-ok" : needed === null ? "tier-no" : "tier-maybe";
    }

    // Countdown with daily bounties alone, only when the tier is close
    // enough to be reached that way before the season ends.
    if (tier.bountyDays.some((d) => d.days !== null)) lines.push(this.describeBountyDays(tier.bountyDays));

    // Bounty effort only matters when the pace is not clearly enough.
    if (tier.atPace !== "yes") {
      lines.push(this.describeBountyPlan(tier.bountyPlan.pessimistic, tier.bountyPlan.optimistic, f));
    }

    // In-person planner: only when relaxed days plus committed events are
    // not enough, i.e. when the agent has to choose between doing more
    // bounties and travelling to events.
    if (tier.bountyPlan.pessimistic.fullDays !== 0) {
      lines.push(...tier.inPerson.map((p) => this.describeInPerson(p)));
    }
    return `<div class="tier ${cls}">${head}${lines.map((l) => `<p>${l}</p>`).join("")}</div>`;
  }

  /**
   * Explain in how many days daily bounties alone reach a tier.
   *
   * @param days - Days needed at each bounty rate.
   */
  private describeBountyDays(days: BountyDays[]): string {
    const t = m();
    const parts = days.map((d) =>
      d.days === null
        ? esc(t.bountyDaysNever(d.bountiesPerDay))
        : t.bountyDaysIn(d.days, d.bountiesPerDay) + costSuffix(d.cost),
    );
    return `${esc(t.bountyDaysPrefix)} ${joinList(parts)}.`;
  }

  /**
   * Explain how many maximum-bounty days are needed.
   *
   * @param worst - Plan with the lowest committed event tokens.
   * @param best - Plan with the highest committed event tokens.
   * @param f - Forecast (for bounty rates).
   */
  private describeBountyPlan(worst: BountyPlan, best: BountyPlan, f: Forecast): string {
    const t = m();
    const b = this.config.dailyBounties;
    const all = b.freeCount;
    const hasPaid = b.freeCount < b.bountyTokens.length;
    const text = (p: BountyPlan) => {
      if (p.fullDays === null) {
        // Free bounties fall short: say whether paid ones would close the gap.
        let paid = "";
        if (hasPaid && p.paidDays !== null) paid = t.planPaidDays(p.paidDays) + costSuffix(p.paidCost);
        else if (hasPaid) paid = t.planPaidShort(fmt(p.paidShortfall));
        return t.planShort(all, fmt(p.shortfall)) + paid;
      }
      if (p.fullDays === 0) return t.planRelaxedEnough(b.relaxedCount, fmt(f.dailyRelaxed));
      return t.planFullDays(all, p.fullDays, b.relaxedCount, p.relaxedDays);
    };
    const w = text(worst);
    const bst = text(best);
    return t.withCommitted(w === bst ? w : w + t.bestCase(bst));
  }

  /**
   * Explain which in-person events are needed at a given bounty rate.
   *
   * @param p - Planner result.
   */
  private describeInPerson(p: InPersonPlan): string {
    const t = m();
    const prefix = esc(t.inPersonPrefix(p.bountiesPerDay, p.cost ? ` (${costText(p.cost)})` : ""));
    if (p.needed === null) return `${prefix} ${esc(t.inPersonImpossible)}`;
    if (p.needed.length === 0) return `${prefix} ${esc(t.inPersonNone)}`;
    const list = p.needed.map(({ category, count }) => {
      const cat = this.config.categories.find((c) => c.id === category);
      const label = cat ? tx(count === 1 ? cat.label : cat.pluralLabel) : category;
      return `<strong>${count} ${esc(label)}</strong>`;
    });
    return `${prefix} ${t.inPersonNeeded(joinList(list))}`;
  }
}

/**
 * Coloured token summary of an event: earned and committed tokens in blue,
 * forfeited ones in red, undecided ones neutral.
 *
 * @param ev - Evaluated event.
 * @returns HTML snippet.
 */
function eventSummary(ev: EventEvaluation): string {
  const t = m();
  const parts: string[] = [];
  if (ev.phase !== "upcoming") {
    parts.push(span(ev.earned.max > 0 ? "pos" : "", t.earnedSummary(fmtRange(ev.earned))));
  }
  // Committed tokens include those of attended events still to be granted,
  // which can be pending after the event is over.
  if (ev.committed.max > 0) {
    parts.push(span("pos", t.toEarnSummary(fmtRange(ev.committed))));
  } else if (ev.phase !== "past" && ev.state.intent !== "no" && ev.potential.max > 0) {
    parts.push(span("", t.availableSummary(fmtRange(ev.potential))));
  }
  if (ev.forfeited.max > 0) parts.push(span("neg", t.lostSummary(fmtRange(ev.forfeited))));
  if (ev.bonus > 0) parts.push(span("pos", t.bonusSummary(fmt(ev.bonus))));
  return parts.join(" · ");
}

/**
 * Translate a forecast warning.
 *
 * @param w - Warning from the engine.
 * @returns User-facing message.
 */
function warningText(w: ForecastWarning): string {
  switch (w.code) {
    case "events-exceed-total":
      return m().warnEventsExceed;
    case "unexplained-tokens":
      return m().warnUnexplained(fmt(w.dailyMax));
    case "paid-bounties":
      return m().warnPaidBounties(w.days) + (w.cost ? ` ${costText(w.cost)}` : "");
  }
}

/**
 * Describe the cost of unlocking paid bounties.
 *
 * @param cost - Cheapest cost.
 * @returns e.g. "≈ 26,000 CMU: €19.16, or €22.06 with C.O.R.E.".
 */
function costText(cost: PaidDaysCost): string {
  return m().cost(
    fmt(cost.cmu),
    fmtEur(cost.eurCents),
    // Nothing to buy beyond the subscriptions: say so instead of "0,00 €".
    cost.eurCentsWithCore > 0 ? fmtEur(cost.eurCentsWithCore) : null,
    cost.coreSubscriptions,
    fmtEur(cost.coreCents),
  );
}

/**
 * Cost of paid bounties as an HTML suffix in parentheses.
 *
 * @param cost - Cheapest cost, or `null` when nothing has to be paid.
 * @returns e.g. " (≈ 1,500 CMU: …)", or an empty string.
 */
function costSuffix(cost: PaidDaysCost | null): string {
  return cost ? ` <span class="muted">(${esc(costText(cost))})</span>` : "";
}

/**
 * Language picker shown in the header.
 *
 * @returns HTML of the select.
 */
export function languagePicker(): string {
  return `<select data-field="lang" aria-label="${esc(m().language)}">
    ${LANGUAGES.map((l) => option(l.code, l.name, l.code === getLang())).join("")}
  </select>`;
}

/**
 * Build a label/control row of an event card.
 *
 * @param label - HTML of the left column.
 * @param control - HTML of the input.
 */
function row(label: string, control: string): string {
  return `<label class="row"><span class="row-label">${label}</span>${control}</label>`;
}

/**
 * Wrap text in a span with an optional class.
 *
 * @param cls - CSS class ("pos", "neg" or empty).
 * @param text - Plain text.
 */
function span(cls: string, text: string): string {
  return `<span${cls ? ` class="${cls}"` : ""}>${esc(text)}</span>`;
}

/**
 * Build an `<option>` element.
 *
 * @param value - Option value.
 * @param label - Visible label.
 * @param selected - Whether it is selected.
 */
function option(value: string, label: string, selected: boolean): string {
  return `<option value="${esc(value)}"${selected ? " selected" : ""}>${esc(label)}</option>`;
}

/**
 * Join HTML fragments as a natural-language list: commas between items and
 * the translated "and" before the last one ("a, b and c").
 *
 * @param items - Already escaped HTML fragments.
 * @returns The joined list.
 */
function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")}${esc(m().and)}${items.at(-1)}`;
}
