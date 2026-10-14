import { tokensForBounties } from "../engine/bounties";
import { todayIso, isIsoDate } from "../engine/dates";
import {
  enforceAssignmentOrder,
  evaluateEvent,
  eventMaxTokens,
  firstLockedAssignment,
  isDetailed,
  type EventEvaluation,
} from "../engine/events";
import {
  forecast,
  type BountyPlan,
  type Forecast,
  type ForecastWarning,
  type InPersonPlan,
  type TierAnalysis,
} from "../engine/forecast";
import type { Range } from "../engine/range";
import { normalizeState, type EventState, type UserState } from "../engine/state";
import type { Assignment, EventConfig, SeriesConfig } from "../series/types";
import { esc, fmt, fmtDates, fmtRange } from "./format";
import { getLang, LANGUAGES, m, setLang, tx, type Lang } from "./i18n";
import { loadState, saveState } from "./storage";

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
          ${c.medals.map((md) => `<li><strong>${esc(tx(md.name))}</strong> ${fmt(md.tokens)}</li>`).join("")}
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
                  .map((n) =>
                    option(String(n), t.bountiesOption(n, fmt(tokensForBounties(c.dailyBounties, n))), this.state.bountiesToday === n),
                  )
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

  /** Explain how daily bounties are rewarded. */
  private renderDailyBounties(): string {
    const t = m();
    const b = this.config.dailyBounties;
    const rows = b.bountyTokens
      .map((_, i) => i + 1)
      .map((n) => `<tr><td>${n}</td><td>${fmt(tokensForBounties(b, n))}</td></tr>`)
      .join("");
    return `
      <div class="source">
        <h3>${esc(t.dailyBounties)}</h3>
        <p class="muted">${t.dailyBountiesInfo(b.relaxedCount)}</p>
        <table class="mini">
          <thead><tr><th>${esc(t.bountiesColumn)}</th><th>${esc(t.tokensPerDayColumn)}</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
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
          ...event.assignments.map((a, i) => this.renderAssignment(id, a, i, st.assignments[i] ?? 0, i >= locked)),
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

    const phaseLabel = { upcoming: t.phaseUpcoming, active: t.phaseActive, past: t.phasePast }[ev.phase];
    const name = esc(tx(event.name));
    return `
      <article class="event phase-${ev.phase}">
        <div class="event-head">
          <h4>${event.infoUrl ? `<a href="${esc(event.infoUrl)}" target="_blank" rel="noopener">${name}</a>` : name}</h4>
          <span class="badge">${esc(phaseLabel)}</span>
          <span class="badge ${event.inPerson ? "badge-inperson" : ""}">${esc(event.inPerson ? t.inPerson : t.remote)}</span>
        </div>
        <p class="muted">${esc(t.upTo(fmtDates(event.startDate, event.endDate), fmt(eventMaxTokens(event))))}</p>
        ${event.notes ? `<p class="note">${esc(tx(event.notes))}</p>` : ""}
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
   */
  private renderAssignment(eventId: string, a: Assignment, index: number, progress: number, locked: boolean): string {
    const t = m();
    let detail: string;
    let options: string;
    if (isDetailed(a)) {
      detail = t.detailedAssignment(a.bounties.map(fmt).join(" + "), fmt(a.reward), a.required, a.bounties.length);
      options = Array.from({ length: a.bounties.length + 1 }, (_, n) =>
        option(String(n), t.bountiesDone(n, a.bounties.length), progress === n),
      ).join("");
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
       ${locked ? `<small class="muted">${esc(t.lockedAssignment)}</small>` : ""}`,
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
        case "completed":
          st.completed = Boolean(value);
          break;
        case "plan":
          st.plan = value === "minimum" ? "minimum" : "full";
          break;
        case "assignment": {
          st.assignments[Number(target.dataset.index)] = num(value);
          // Assignments unlock in order: lowering one below its completion
          // threshold clears the later ones, and the card is redrawn so the
          // right selects are enabled.
          const event = this.config.events.find((e) => e.id === eventId);
          if (event?.kind === "campaign") {
            st.assignments = enforceAssignmentOrder(event.assignments, st.assignments);
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

    const stats: [string, string, string?][] = [];
    if (f.season === "running") {
      stats.push([t.daysElapsed, t.daysOf(f.elapsedDays, f.totalDays), t.daysLeftAfterToday(f.remainingDays)]);
    } else if (f.season === "upcoming") {
      stats.push([t.season, t.notStartedSeason, t.daysInTotal(f.totalDays)]);
    } else {
      stats.push([t.season, t.finished]);
    }
    stats.push([t.eventTokensEarned, fmtRange(f.eventsEarned)]);
    if (f.elapsedDays > 0) stats.push([t.pastBountyTokens, fmtRange(f.pastBountyTokens)]);
    if (f.averagePerDay) {
      stats.push([t.yourPace, t.perDay(fmtRange(f.averagePerDay, true)), this.paceAsBounties(f.averagePerDay)]);
    }
    stats.push([t.committedToCome, fmtRange(f.committedRemaining), t.committedHint]);
    if (f.projection) stats.push([t.projectedTotal, fmtRange(f.projection), this.tierNames(f.projection)]);

    parts.push(
      `<dl class="stats">${stats
        .map(([k, v, sub]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd>${sub ? `<dd class="muted">${esc(sub)}</dd>` : ""}</div>`)
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
   * @returns e.g. "Gold" or "Silver – Gold".
   */
  private tierNames(r: Range): string {
    const tier = (v: number) => {
      const reached = [...this.config.medals].reverse().find((md) => v >= md.tokens);
      return reached ? tx(reached.name) : m().noMedal;
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
    const head = `<h3>${esc(tx(tier.tier.name))} <span class="muted">(${fmt(tier.tier.tokens)})</span></h3>`;
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
      lines.push(t.paceNo(fmtRange(f.projection), fmtRange(missing)));
    } else {
      // No pace yet (season not started or first day): judge the tier by the
      // effort the committed plan requires instead.
      const needed = tier.bountyPlan.pessimistic.fullDays;
      cls = needed === 0 ? "tier-ok" : needed === null ? "tier-no" : "tier-maybe";
    }

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
   * Explain how many maximum-bounty days are needed.
   *
   * @param worst - Plan with the lowest committed event tokens.
   * @param best - Plan with the highest committed event tokens.
   * @param f - Forecast (for bounty rates).
   */
  private describeBountyPlan(worst: BountyPlan, best: BountyPlan, f: Forecast): string {
    const t = m();
    const b = this.config.dailyBounties;
    const all = b.bountyTokens.length;
    const text = (p: BountyPlan) => {
      if (p.fullDays === null) return t.planShort(all, fmt(p.shortfall));
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
    const prefix = esc(t.inPersonPrefix(p.bountiesPerDay));
    if (p.needed === null) return `${prefix} ${esc(t.inPersonImpossible)}`;
    if (p.needed.length === 0) return `${prefix} ${esc(t.inPersonNone)}`;
    const list = p.needed.map(({ category, count }) => {
      const cat = this.config.categories.find((c) => c.id === category);
      const label = cat ? tx(count === 1 ? cat.label : cat.pluralLabel) : category;
      return `<strong>${count} ${esc(label)}</strong>`;
    });
    return `${prefix} ${t.inPersonNeeded(list.join(esc(t.and)))}`;
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
  if (ev.phase !== "past" && ev.state.intent !== "no" && ev.potential.max > 0) {
    parts.push(
      ev.state.intent === "yes"
        ? span("pos", t.toEarnSummary(fmtRange(ev.potential)))
        : span("", t.availableSummary(fmtRange(ev.potential))),
    );
  }
  if (ev.forfeited.max > 0) parts.push(span("neg", t.lostSummary(fmtRange(ev.forfeited))));
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
  }
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
