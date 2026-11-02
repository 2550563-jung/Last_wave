import { execFileSync } from "node:child_process";
import fs from "node:fs";

const scripts=fs.readdirSync(".").filter(name=>name.endsWith(".js"));
scripts.push("desktop/main.cjs");
for(const script of scripts)execFileSync(process.execPath,["--check",script],{stdio:"inherit"});
console.log(`Syntax OK: ${scripts.length} scripts`);
