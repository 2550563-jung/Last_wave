import assert from "node:assert/strict";
import fs from "node:fs";

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),"utf8");
const base="https://2550563-jung.github.io/Last_wave/";

for(const [file,url] of [["index.html",base],["about/index.html",`${base}about/`]]){
  const html=read(file);
  assert.ok(html.includes(`<link rel="canonical" href="${url}">`),`${file}: canonical`);
  assert.match(html,/<title>[^<]*Last Wave\(라스트 웨이브\)[^<]*<\/title>/,`${file}: title`);
  assert.match(html,/<meta name="description" content="[^"]{50,160}">/,`${file}: description`);
  assert.ok(html.includes(`property="og:image" content="${base}about/og.jpg"`),`${file}: og:image`);
  const data=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(data["@type"],"VideoGame");
  assert.equal(data.numberOfPlayers.maxValue,Number(read("last-wave-core-1.js").match(/MULTIPLAYER_MAX_PLAYERS=\s*(\d+)/)[1]));
  assert.ok(sitemapHas(url),`${file}: not in sitemap`);
}
function sitemapHas(url){return read("sitemap.xml").includes(`<loc>${url}</loc>`);}

for(const image of ["about/og.jpg","about/hero.webp","about/shop.webp"])assert.ok(fs.existsSync(new URL(`../${image}`,import.meta.url)),image);
assert.match(read(".github/workflows/static.yml"),/sitemap\.xml.* about /,"deploy must publish the page and sitemap");
console.log("SEO OK");
