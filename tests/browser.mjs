import fs from "node:fs";
import { chromium as playwrightChromium } from "playwright";

const root=new URL("../",import.meta.url);

// Bundled Chromium by default. CHROME_PATH overrides it, and Windows falls back
// to the installed Chrome so `npm test` works without `playwright install`.
function browserOptions(){
  if(process.env.CHROME_PATH)return {executablePath:process.env.CHROME_PATH};
  if(process.platform==="win32"&&!process.env.CI)return {channel:"chrome"};
  return {};
}

export const chromium={
  launch:(options={})=>playwrightChromium.launch({...options,...browserOptions()})
};

// Source of the page and its core scripts, which index.html loads in this order.
export function readGameSource(){
  const files=fs.readdirSync(root).filter(name=>/^last-wave-core-\d+\.js$/.test(name)).sort();
  return ["index.html",...files].map(name=>fs.readFileSync(new URL(name,root),"utf8")).join("\n");
}

export const GAME_VERSION=readGameSource().match(/const GAME_VERSION="(v\d+)"/)[1];
