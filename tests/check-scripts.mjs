import fs from "node:fs";
import vm from "node:vm";

// Parse as classic scripts, which is how index.html loads them.
const scripts=fs.readdirSync(".").filter(name=>name.endsWith(".js"));
scripts.push("desktop/main.cjs");
for(const script of scripts)new vm.Script(fs.readFileSync(script,"utf8"),{filename:script});
console.log(`Syntax OK: ${scripts.length} scripts`);
