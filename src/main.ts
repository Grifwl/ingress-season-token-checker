import "./style.css";
import { allSeries, findSeries } from "./series";
import { esc, fmtDates } from "./ui/format";
import { SeriesPage } from "./ui/seriesPage";

/**
 * Entry point and router.
 *
 * Each series lives at its own path (`/cygnus`, ...). The root lists every
 * series; any other path shows a "not found" message. The hosting falls back
 * to this same page for every path, so routing happens entirely here.
 */
function main(): void {
  const root = document.getElementById("app")!;
  const slug = location.pathname.replace(/^\/+|\/+$/g, "").toLowerCase();

  if (slug === "") {
    renderIndex(root);
    return;
  }
  const config = findSeries(slug);
  if (config) {
    new SeriesPage(root, config);
  } else {
    root.innerHTML = `
      <header class="page-header"><h1>Series not found</h1>
      <p>There is no forecast for “${esc(slug)}”. <a href="/">See every series</a>.</p></header>`;
  }
}

/**
 * Render the list of supported series.
 *
 * @param root - Element to render into.
 */
function renderIndex(root: HTMLElement): void {
  root.innerHTML = `
    <header class="page-header">
      <h1>Ingress season token forecast</h1>
      <p class="muted">Find out which season medal you are heading for, and what it takes to reach the next one.</p>
    </header>
    <section class="card">
      <ul class="series-list">
        ${allSeries
          .map((s) => `<li><a href="/${esc(s.id)}">${esc(s.name)}</a>
            <span class="muted">${fmtDates(s.startDate, s.endDate)} ${s.startDate.slice(0, 4)}</span></li>`)
          .join("")}
      </ul>
    </section>`;
}

main();
