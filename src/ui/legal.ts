import { esc } from "./format";
import { getLang, m } from "./i18n";

/**
 * Site footer and privacy page.
 *
 * Every page ends with the same footer: who runs the site, a link to the
 * privacy page and the source code, and the trademark disclaimer. The
 * privacy page explains that answers never leave the browser.
 */

/** Personal site of the owner; every mention of the alias links to it. */
const OWNER_URL = "https://grifwl.blue";
const OWNER_ALIAS = "Grifwl";
const REPO_URL = "https://github.com/Grifwl/ingress-season-token-checker";
const ISSUES_URL = `${REPO_URL}/issues`;
const CLOUDFLARE_PRIVACY_URL = "https://www.cloudflare.com/privacypolicy/";

/**
 * Build an external link that opens in a new tab.
 *
 * @param url - Target URL.
 * @param text - Plain link text.
 * @returns HTML of the link.
 */
function extLink(url: string, text: string): string {
  return `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(text)}</a>`;
}

/**
 * Footer shown at the bottom of every page.
 *
 * @returns HTML of the footer.
 */
export function pageFooter(): string {
  const t = m();
  return `
    <footer class="page-footer">
      <p>© 2026 ${extLink(OWNER_URL, OWNER_ALIAS)} ·
        <a href="/privacy">${esc(t.privacyTitle)}</a> ·
        ${extLink(REPO_URL, t.sourceCode)}</p>
      <p>${esc(t.trademarkDisclaimer)}</p>
    </footer>`;
}

/**
 * Render the privacy page.
 *
 * @param root - Element to render into.
 * @param header - HTML of the top bar (navigation and language picker).
 */
export function renderPrivacy(root: HTMLElement, header: string): void {
  const t = m();
  const owner = extLink(OWNER_URL, OWNER_ALIAS);
  const sections: [string, string][] = [
    [t.privacyOwnerTitle, t.privacyOwner(owner)],
    [t.privacyStoredTitle, t.privacyStored],
    [t.privacyNotCollectedTitle, t.privacyNotCollected],
    [t.privacyHostingTitle, t.privacyHosting(extLink(CLOUDFLARE_PRIVACY_URL, t.cloudflarePolicy))],
    [t.privacyLinksTitle, t.privacyLinks],
    [t.privacyContactTitle, t.privacyContact(extLink(ISSUES_URL, t.githubIssue), owner)],
  ];
  document.title = t.privacyTitle;
  document.documentElement.lang = getLang();
  root.innerHTML = `
    <header class="page-header">
      ${header}
      <h1>${esc(t.privacyTitle)}</h1>
      <p class="muted">${esc(t.privacyUpdated)}</p>
    </header>
    <section class="card prose">
      ${sections.map(([title, body]) => `<h2>${esc(title)}</h2><p>${body}</p>`).join("")}
    </section>
    ${pageFooter()}`;
}
