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

export function readGameSource(){
  return fs.readFileSync(new URL("index.html",root),"utf8");
}

export const GAME_VERSION=readGameSource().match(/const GAME_VERSION="(v\d+)"/)[1];
