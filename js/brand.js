// brand.js — single source of truth for brand name/logo markup, so every
// view (sidebar, login, onboarding, printed reports) stays in sync if the
// identity ever changes again.
const Brand = (() => {
  const NAME = 'GrowMark';
  const PARENT = 'Growistan';
  const TAGLINE = 'by Growistan';

  /**
   * Small square "G" mark (matches the favicon) for compact contexts.
   * @param {string} [cls]
   * @returns {string}
   */
  function markImg(cls = '') {
    return `<img src="assets/favicon.svg" alt="" class="brand-mark-img ${cls}" width="28" height="28" />`;
  }

  /**
   * Full horizontal lockup (mark + "GrowMark" + "by Growistan") as a single image.
   * @param {string} [cls]
   * @returns {string}
   */
  function fullLogoImg(cls = '') {
    return `<img src="assets/logo.svg" alt="${NAME} — ${TAGLINE}" class="brand-logo-img ${cls}" />`;
  }

  /** HTML for the sidebar/topbar brand lockup: mark + name + small tagline. */
  function sidebarBrandHtml() {
    return `
      <span class="brand-mark">${markImg()}</span>
      <span class="brand-text">
        <span class="brand-name">${NAME}</span>
        <span class="brand-tagline">${TAGLINE}</span>
      </span>`;
  }

  return { NAME, PARENT, TAGLINE, markImg, fullLogoImg, sidebarBrandHtml };
})();
