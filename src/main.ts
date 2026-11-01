import "./style.css";
import { allSeries, currentSeries, findSeries } from "./series";
import { esc, fmtDates } from "./ui/format";
import { getLang, m, setLang, type Lang } from "./ui/i18n";
import { pageFooter, renderPrivacy } from "./ui/legal";
import { languagePicker, SeriesPage } from "./ui/seriesPage";

/**
 * Entry point and router.
 *
 * Each series lives at its own path (`/cygnus`, ...). The root lists every
 * series, `/current` redirects to the season in progress and `/privacy`
 * holds the privacy page; any other path shows a
 * "not found" message. The hosting falls back
 * to this same page for every path, so routing happens entirely here.
 */
function main(): void {
  const root = document.getElementById("app")!;
  const slug = location.pathname.replace(/^\/+|\/+$/g, "").toLowerCase();

  // `/current` is a stable link (e.g. for social profiles) that always
  // leads to the season in progress. `replace` keeps it out of the history
  // so the back button does not bounce through the redirect again.
  if (slug === "current") {
    location.replace(`/${currentSeries().id}`);
    return;
  }

  const config = slug ? findSeries(slug) : undefined;

  if (config) {
    // The series page handles its own language picker.
    new SeriesPage(root, config);
    return;
  }

  const renderStatic = () => {
    if (!slug) renderIndex(root);
    else if (slug === "privacy") renderPrivacy(root, `<div class="top-bar"><a href="/">${esc(m().allSeries)}</a>${languagePicker()}</div>`);
    else renderNotFound(root, slug);
  };
  root.addEventListener("change", (e) => {
    const target = e.target as HTMLSelectElement;
    if (target.dataset.field === "lang") {
      setLang(target.value as Lang);
      renderStatic();
    }
  });
  renderStatic();
}

/**
 * Render the list of supported series.
 *
 * @param root - Element to render into.
 */
function renderIndex(root: HTMLElement): void {
  const t = m();
  document.title = t.indexTitle;
  document.documentElement.lang = getLang();
  root.innerHTML = `
    <header class="page-header">
      <div class="top-bar"><span></span>${languagePicker()}</div>
      <h1>${esc(t.indexTitle)}</h1>
      <p class="muted">${esc(t.indexIntro)}</p>
    </header>
    <section class="card">
      <ul class="series-list">
        ${allSeries
          .map((s) => `<li><a href="/${esc(s.id)}">${esc(s.name)}</a>
            <span class="muted">${fmtDates(s.startDate, s.endDate)} ${s.startDate.slice(0, 4)}</span></li>`)
          .join("")}
      </ul>
    </section>
    ${pageFooter()}`;
}

/**
 * Render the "unknown series" page.
 *
 * @param root - Element to render into.
 * @param slug - Requested path.
 */
function renderNotFound(root: HTMLElement, slug: string): void {
  const t = m();
  document.title = t.notFoundTitle;
  document.documentElement.lang = getLang();
  root.innerHTML = `
    <header class="page-header">
      <div class="top-bar"><span></span>${languagePicker()}</div>
      <h1>${esc(t.notFoundTitle)}</h1>
      <p>${esc(t.notFound(slug))} <a href="/">${esc(t.seeAllSeries)}</a>.</p>
    </header>
    ${pageFooter()}`;
}

main();
