import localFont from "next/font/local";

/*
 * Self-hosted from @fontsource packages: builds never depend on Google Fonts.
 * next/font adds size-adjusted fallbacks, so swapping in causes no layout shift.
 * Chinese serif (Noto Serif SC) is loaded as a CSS import in layout.tsx because
 * it ships as ~100 unicode-range slices that the browser fetches on demand.
 *
 * `fallback` lists must NOT end in a generic family (serif / sans-serif /
 * monospace): a generic always matches, so the CJK fonts that tokens.css
 * appends after these variables would never be reached, and Chinese would
 * fall back to the system's generic face (which also fakes italics).
 */

export const newsreader = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource-variable/newsreader/files/newsreader-latin-standard-normal.woff2",
      weight: "200 800",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource-variable/newsreader/files/newsreader-latin-standard-italic.woff2",
      weight: "200 800",
      style: "italic",
    },
  ],
  variable: "--font-newsreader",
  display: "swap",
  fallback: ["Georgia", "Times New Roman"],
});

export const sourceSans = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource-variable/source-sans-3/files/source-sans-3-latin-wght-normal.woff2",
      weight: "200 900",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource-variable/source-sans-3/files/source-sans-3-latin-wght-italic.woff2",
      weight: "200 900",
      style: "italic",
    },
  ],
  variable: "--font-source-sans",
  display: "swap",
  fallback: ["Segoe UI", "Helvetica Neue", "Arial"],
});

/** Historic letterpress face (the Fell types): running heads, captions, marginalia. */
export const fell = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource/im-fell-english/files/im-fell-english-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource/im-fell-english/files/im-fell-english-latin-400-italic.woff2",
      weight: "400",
      style: "italic",
    },
  ],
  variable: "--font-fell",
  display: "swap",
  fallback: ["Georgia"],
});

export const plexMono = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2",
      weight: "500",
      style: "normal",
    },
  ],
  variable: "--font-plex-mono",
  display: "swap",
  fallback: ["Consolas"],
});
