import {copyFileSync,cpSync,mkdirSync,readFileSync} from "node:fs";
import {resolve} from "node:path";
const packageRoot=resolve("node_modules/pdfjs-dist");
const {version}=JSON.parse(readFileSync(resolve(packageRoot,"package.json"),"utf8"));
const destination=resolve("public/pdfjs",version);
mkdirSync(destination,{recursive:true});
copyFileSync(resolve(packageRoot,"build/pdf.worker.min.mjs"),resolve(destination,"pdf.worker.min.mjs"));
for(const directory of ["standard_fonts","cmaps","wasm","iccs"]) cpSync(resolve(packageRoot,directory),resolve(destination,directory),{recursive:true});
console.log(`PDF.js ${version} browser assets ready (served locally, no external CDN).`);
