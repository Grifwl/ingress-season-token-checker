import { tokensForBounties } from "../engine/bounties";
import { todayIso, isIsoDate } from "../engine/dates";
import { evaluateEvent, eventMaxTokens, isDetailed, type EventEvaluation } from "../engine/events";
import { forecast, type BountyPlan, type Forecast, type InPersonPlan, type TierAnalysis } from "../engine/forecast";
import type { Range } from "../engine/range";
import { normalizeState, type EventState, type UserState } from "../engine/state";
import type { EventConfig, SeriesConfig } from "../series/types";
import { esc, fmt, fmtDates, fmtRange, plural } from "./format";
import { loadState, saveState } from "./storage";

/**
 * Interactive forecast page for one series.
 *
 * Responsibilities:
 * - render the input form (current tokens, today's bounties, every event);
 * - keep the agent's answers in memory and in browser storage;
 * - recompute and render the forecast after every change.
 *
 * The form is rendered once and only re-rendered when the forecast date
 * changes (which changes which controls each event needs). Every other edit
 * only refreshes the results, so inputs never lose focus while typing.
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
    document.title = `${config.name} token forecast`;
    this.root.addEventListener("input", (e) => this.onEdit(e, false));
    this.root.addEventListener("change", (e) => this.onEdit(e, true));
    this.render();
  }

  /** Render the whole page and fill in the results. */
  private render(): void {
    const c = this.config;
    this.root.innerHTML = `
      <header class="page-header">
        <p class="eyebrow"><a href="/">Ingress seasons</a></p>
        <h1>${esc(c.name)} token forecast</h1>
        <p class="muted">${fmtDates(c.startDate, c.endDate)} ${c.startDate.slice(0, 4)} ·
          <a href="${esc(c.infoUrl)}" target="_blank" rel="noopener">official announcement</a></p>
        <ul class="medals">
          ${c.medals.map((m) => `<li><strong>${esc(m.name)}</strong> ${fmt(m.tokens)}</li>`).join("")}
        </ul>
      </header>

      <div class="layout">
      <section class="card area-status">
        <h2>Your status</h2>
        <div class="fields">
          <label>Date
            <input type="date" data-field="today" value="${this.today}">
          </label>
          <label>Current ${esc(c.tokenName)}
            <input type="number" inputmode="numeric" min="0" step="10" data-field="currentTokens"
              value="${this.state.currentTokens || ""}" placeholder="0">
          </label>
          <label>Daily bounties done today
            <select data-field="bountiesToday">
              ${c.dailyBounties.bountyTokens
                .map((_, i) => i + 1)
                .concat(0)
                .sort((a, b) => a - b)
                .map((n) => option(String(n), `${n} (${fmt(tokensForBounties(c.dailyBounties, n))} tokens)`, this.state.bountiesToday === n))
                .join("")}
            </select>
          </label>
        </div>
      </section>

      <section class="card area-sources">
        <h2>Token sources</h2>
        ${this.renderDailyBounties()}
        ${c.categories.map((cat) => this.renderCategory(cat.id, cat.pluralLabel)).join("")}
      </section>

      <aside class="card area-results" id="results" aria-live="polite"></aside>
      </div>
    `;
    this.updateResults();
  }

  /** Explain how daily bounties are rewarded. */
  private renderDailyBounties(): string {
    const b = this.config.dailyBounties;
    const rows = b.bountyTokens
      .map((_, i) => i + 1)
      .map((n) => `<tr><td>${n}</td><td>${fmt(tokensForBounties(b, n))}</td></tr>`)
      .join("");
    return `
      <div class="source">
        <h3>Daily Research Bounties</h3>
        <p class="muted">Every day of the season. The first ${b.relaxedCount} are usually doable from home;
          the forecast calls that a <em>relaxed</em> day.</p>
        <table class="mini"><thead><tr><th>Bounties</th><th>Tokens / day</th></tr></thead><tbody>${rows}</tbody></table>
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
   * Render one event with the controls its phase needs.
   *
   * @param event - Event config.
   */
  private renderEvent(event: EventConfig): string {
    const st = this.state.events[event.id]!;
    const ev = evaluateEvent(event, st, this.today);
    const id = esc(event.id);
    const controls: string[] = [];

    if (ev.phase !== "past") {
      controls.push(`
        <label>Plan
          <select data-event="${id}" data-prop="intent">
            ${option("yes", "I'll do it", st.intent === "yes")}
            ${option("maybe", "Not sure", st.intent === "maybe")}
            ${option("no", "I won't", st.intent === "no")}
          </select>
        </label>`);
    }

    if (event.kind === "fixed" && ev.phase !== "upcoming") {
      controls.push(`
        <label class="check">
          <input type="checkbox" data-event="${id}" data-prop="completed" ${st.completed ? "checked" : ""}>
          I got these tokens
        </label>`);
    }

    if (event.kind === "campaign") {
      if (ev.phase !== "upcoming") {
        controls.push(
          event.assignments
            .map((a, i) => {
              const p = st.assignments[i] ?? 0;
              const opts = isDetailed(a)
                ? a.bounties.map((_, n) => n + 1).concat(0).sort((x, y) => x - y)
                    .map((n) => option(String(n), `${n} of ${a.bounties.length} bounties`, p === n)).join("")
                : [option("0", "Not started", p === 0), option("1", "In progress", p === 1), option("2", "Completed", p === 2)].join("");
              const detail = isDetailed(a)
                ? `${a.bounties.map(fmt).join(" + ")} + ${fmt(a.reward)} for ${a.required} of ${a.bounties.length}`
                : `${fmt(a.total)} in total`;
              return `
                <label>${esc(a.name)} <span class="muted">(${detail})</span>
                  <select data-event="${id}" data-prop="assignment" data-index="${i}">${opts}</select>
                  ${a.note ? `<small class="muted">${esc(a.note)}</small>` : ""}
                </label>`;
            })
            .join(""),
        );
      }
      const canSkip = event.assignments.some((a) => isDetailed(a) && a.required < a.bounties.length);
      if (ev.phase !== "past" && canSkip) {
        controls.push(`
          <label>Remaining assignments
            <select data-event="${id}" data-prop="plan">
              ${option("full", "Every bounty", st.plan === "full")}
              ${option("minimum", "Only the required bounties", st.plan === "minimum")}
            </select>
          </label>`);
      }
    }

    if (event.kind === "open" && ev.phase !== "upcoming") {
      controls.push(`
        <label>Tokens earned so far (at least)
          <input type="number" inputmode="numeric" min="0" step="10" data-event="${id}" data-prop="earnedMin"
            value="${st.earnedMin || ""}" placeholder="0">
        </label>
        <label>…and at most
          <input type="number" inputmode="numeric" min="0" step="10" data-event="${id}" data-prop="earnedMax"
            value="${st.earnedMax || ""}" placeholder="same">
        </label>`);
    }

    const phaseLabel = { upcoming: "Upcoming", active: "In progress", past: "Finished" }[ev.phase];
    return `
      <article class="event phase-${ev.phase}">
        <div class="event-head">
          <h4>${event.infoUrl ? `<a href="${esc(event.infoUrl)}" target="_blank" rel="noopener">${esc(event.name)}</a>` : esc(event.name)}</h4>
          <span class="badge">${phaseLabel}</span>
          <span class="badge ${event.inPerson ? "badge-inperson" : ""}">${event.inPerson ? "In person" : "Remote"}</span>
        </div>
        <p class="muted">${fmtDates(event.startDate, event.endDate)} · up to ${fmt(eventMaxTokens(event))} tokens</p>
        ${event.notes ? `<p class="note">${esc(event.notes)}</p>` : ""}
        <div class="fields">${controls.join("")}</div>
        <p class="event-summary" data-summary="${id}"></p>
      </article>`;
  }

  /**
   * Apply an edit from any form control.
   *
   * @param e - DOM input/change event.
   * @param committed - `true` for "change" events (value finished).
   */
  private onEdit(e: Event, committed: boolean): void {
    const t = e.target as HTMLInputElement | HTMLSelectElement;
    const value = t.type === "checkbox" ? (t as HTMLInputElement).checked : t.value;
    const num = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0));

    if (t.dataset.field === "today") {
      // Changing the date changes which controls each event shows, so the
      // whole page is re-rendered, but only once the value is final.
      if (committed && isIsoDate(value)) {
        this.today = value;
        this.render();
      }
      return;
    }
    if (t.dataset.field === "currentTokens") this.state.currentTokens = num(value);
    if (t.dataset.field === "bountiesToday") this.state.bountiesToday = num(value);

    const eventId = t.dataset.event;
    if (eventId) {
      const st: EventState = this.state.events[eventId]!;
      switch (t.dataset.prop) {
        case "intent":
          st.intent = value as EventState["intent"];
          break;
        case "completed":
          st.completed = Boolean(value);
          break;
        case "plan":
          st.plan = value === "minimum" ? "minimum" : "full";
          break;
        case "assignment":
          st.assignments[Number(t.dataset.index)] = num(value);
          break;
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

  /** Recompute the forecast and refresh the results and event summaries. */
  private updateResults(): void {
    const f = forecast(this.config, this.state, this.today);
    for (const ev of f.evaluations) {
      const el = this.root.querySelector<HTMLElement>(`[data-summary="${CSS.escape(ev.event.id)}"]`);
      if (el) el.textContent = eventSummary(ev);
    }
    this.root.querySelector("#results")!.innerHTML = this.renderResults(f);
  }

  /**
   * Render the forecast.
   *
   * @param f - Forecast result.
   */
  private renderResults(f: Forecast): string {
    const c = this.config;
    const parts: string[] = ["<h2>Forecast</h2>"];

    if (f.warnings.length) {
      parts.push(`<div class="warnings">${f.warnings.map((w) => `<p>⚠ ${esc(w)}</p>`).join("")}</div>`);
    }

    const stats: [string, string, string?][] = [];
    if (f.season === "running") {
      stats.push(["Days elapsed", `${f.elapsedDays} of ${f.totalDays}`, `${plural(f.remainingDays, "day")} left after today`]);
    } else if (f.season === "upcoming") {
      stats.push(["Season", "Not started", `${f.totalDays} days in total`]);
    } else {
      stats.push(["Season", "Finished", ""]);
    }
    stats.push(["Event tokens earned", fmtRange(f.eventsEarned)]);
    if (f.elapsedDays > 0) {
      stats.push(["Daily bounty tokens before today", fmtRange(f.pastBountyTokens)]);
    }
    if (f.averagePerDay) {
      stats.push(["Your pace", `${fmtRange(f.averagePerDay, true)} / day`, this.paceAsBounties(f.averagePerDay)]);
    }
    stats.push(["Committed event tokens to come", fmtRange(f.committedRemaining), "events marked “I'll do it”"]);
    if (f.projection) {
      const tier = (v: number) => [...c.medals].reverse().find((m) => v >= m.tokens)?.name ?? "No medal";
      const tiers = tier(f.projection.min) === tier(f.projection.max)
        ? tier(f.projection.min)
        : `${tier(f.projection.min)} – ${tier(f.projection.max)}`;
      stats.push(["Projected final total", fmtRange(f.projection), tiers]);
    }
    parts.push(
      `<dl class="stats">${stats
        .map(([k, v, sub]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd>${sub ? `<dd class="muted">${esc(sub)}</dd>` : ""}</div>`)
        .join("")}</dl>`,
    );

    if (f.season !== "over") {
      parts.push(f.tiers.map((t) => this.renderTier(t, f)).join(""));
    }

    if (f.undecided.length) {
      parts.push(`
        <h3>Not decided yet</h3>
        <ul class="undecided">${f.undecided
          .map((e) => `<li>${esc(e.event.name)} <span class="muted">(${fmtDates(e.event.startDate, e.event.endDate)})</span>: +${fmtRange(e.potential)}</li>`)
          .join("")}</ul>`);
    }
    return parts.join("");
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
      counts.reduce((best, n) =>
        Math.abs(tokensForBounties(b, n) - v) < Math.abs(tokensForBounties(b, best) - v) ? n : best,
      0);
    const lo = nearest(avg.min);
    const hi = nearest(avg.max);
    return lo === hi ? `≈ ${plural(lo, "bounty", "bounties")} a day` : `≈ ${lo}–${hi} bounties a day`;
  }

  /**
   * Render the outlook for one tier.
   *
   * @param t - Tier analysis.
   * @param f - Whole forecast (for context).
   */
  private renderTier(t: TierAnalysis, f: Forecast): string {
    const name = esc(t.tier.name);
    const head = `<h3>${name} <span class="muted">(${fmt(t.tier.tokens)})</span></h3>`;
    if (t.reached) return `<div class="tier tier-ok">${head}<p>✔ Already unlocked.</p></div>`;

    const lines: string[] = [];
    let cls = "tier-no";
    if (t.atPace === "yes") {
      cls = "tier-ok";
      lines.push("✔ You get there at your current pace with the events you committed to.");
    } else if (t.atPace === "maybe") {
      cls = "tier-maybe";
      lines.push("≈ At your current pace you only get there in the best case.");
    } else if (t.atPace === "no") {
      lines.push("✘ Your current pace is not enough.");
    } else {
      // No pace yet (season not started or first day): judge the tier by the
      // effort the committed plan requires instead.
      const needed = t.bountyPlan.pessimistic.fullDays;
      cls = needed === 0 ? "tier-ok" : needed === null ? "tier-no" : "tier-maybe";
    }

    // Bounty effort only matters when the pace is not clearly enough.
    if (t.atPace !== "yes") {
      lines.push(this.describeBountyPlan(t.bountyPlan.pessimistic, t.bountyPlan.optimistic, f));
    }

    // In-person planner: only when relaxed days plus committed events are
    // not enough, i.e. when the agent has to choose between doing more
    // bounties and travelling to events.
    if (t.bountyPlan.pessimistic.fullDays !== 0) {
      lines.push(...t.inPerson.map((p) => this.describeInPerson(p)));
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
    const b = this.config.dailyBounties;
    const all = b.bountyTokens.length;
    const relaxed = b.relaxedCount;
    const text = (p: BountyPlan) => {
      if (p.fullDays === null) {
        return `even with ${all} bounties every day you are ${fmt(p.shortfall)} tokens short`;
      }
      if (p.fullDays === 0) return `${relaxed} bounties a day (${f.dailyRelaxed} tokens) are enough`;
      return `do all ${all} bounties on <strong>${plural(p.fullDays, "day")}</strong>; ` +
        `${relaxed} are enough on the other ${plural(p.relaxedDays, "day")}`;
    };
    const w = text(worst);
    const bst = text(best);
    const sentence = w === bst ? w : `${w} (best case: ${bst})`;
    return `With the events you committed to, ${sentence}.`;
  }

  /**
   * Explain which in-person events are needed at a given bounty rate.
   *
   * @param p - Planner result.
   */
  private describeInPerson(p: InPersonPlan): string {
    const prefix = `With ${p.bountiesPerDay} bounties a day and every remote event you have not ruled out completed,`;
    if (p.needed === null) return `${prefix} not reachable even attending every remaining in-person event.`;
    if (p.needed.length === 0) return `${prefix} no in-person event is needed.`;
    const list = p.needed.map(({ category, count }) => {
      const cat = this.config.categories.find((c) => c.id === category);
      return `<strong>${plural(count, cat?.label ?? category, cat?.pluralLabel)}</strong>`;
    });
    return `${prefix} attend at least ${list.join(" and ")}.`;
  }
}

/**
 * One-line token summary of an event.
 *
 * @param ev - Evaluated event.
 * @returns e.g. "Earned 600 · still available 1,400".
 */
function eventSummary(ev: EventEvaluation): string {
  const parts: string[] = [];
  if (ev.phase !== "upcoming") parts.push(`Earned ${fmtRange(ev.earned)}`);
  if (ev.phase !== "past") parts.push(`still available ${fmtRange(ev.potential)}`);
  return parts.join(" · ");
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
