const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const htmlFiles = fs.readdirSync(root).filter(file => file.endsWith(".html"));
const serviceWorker = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const precache = new Set(
  [...serviceWorker.matchAll(/^\s*"([^\"]+)"[,]?$/gm)].map(match => match[1])
);

test("application pages load the pinned icon font from the local bundle", () => {
  const cssPath = "vendor/tabler-icons/2.44.0/tabler-icons.min.css";
  const css = fs.readFileSync(path.join(root, cssPath), "utf8");
  const pages = htmlFiles.filter(file => fs.readFileSync(path.join(root, file), "utf8").includes("ti-"));

  assert.ok(pages.length > 0, "expected pages to use Tabler icon classes");
  assert.ok(css.includes('./fonts/tabler-icons.woff2?v2.44.0'), "the icon stylesheet should resolve its bundled WOFF2 font");
  assert.ok(fs.existsSync(path.join(root, "vendor/tabler-icons/2.44.0/fonts/tabler-icons.woff2")));
  for (const page of pages) {
    const html = fs.readFileSync(path.join(root, page), "utf8");
    assert.ok(html.includes(cssPath), `${page} should use the local Tabler stylesheet`);
    assert.ok(!html.includes("cdn.jsdelivr.net/npm/@tabler/icons-webfont"), `${page} should not require the CDN`);
  }
});

test("the stats page loads local Chart.js and the service worker precaches offline assets", () => {
  const statsPage = fs.readFileSync(path.join(root, "stats.html"), "utf8");
  const chartPath = "vendor/chart.js/4.4.1/chart.umd.js";
  const iconCss = "vendor/tabler-icons/2.44.0/tabler-icons.min.css";
  const iconFont = "vendor/tabler-icons/2.44.0/fonts/tabler-icons.woff2";

  assert.ok(statsPage.includes(chartPath), "stats should use the local Chart.js bundle");
  assert.ok(!statsPage.includes("cdnjs.cloudflare.com/ajax/libs/Chart.js"), "stats should not require the CDN");
  for (const asset of [iconCss, iconFont, chartPath]) {
    assert.ok(fs.existsSync(path.join(root, asset)), `${asset} should exist in the repository`);
    assert.ok(precache.has(asset), `${asset} should be in the service worker precache`);
  }
});
