import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const mime={
  ".html":"text/html; charset=utf-8",
  ".js":"text/javascript; charset=utf-8",
  ".css":"text/css; charset=utf-8",
  ".json":"application/json; charset=utf-8",
  ".png":"image/png",
  ".svg":"image/svg+xml"
};

export async function startTestServer(){
  const server=http.createServer(async(request,response)=>{
    try{
      const requestPath=decodeURIComponent(request.url.split("?")[0]);
      const relative=requestPath==="/"?"/index.html":requestPath;
      const target=path.resolve(root,`.${relative}`);
      if(!target.startsWith(root)){
        response.writeHead(403);
        response.end("Forbidden");
        return;
      }
      const data=await fs.readFile(target);
      response.setHeader("Content-Type",mime[path.extname(target)]||"application/octet-stream");
      response.end(data);
    }catch{
      response.writeHead(404);
      response.end("Not found");
    }
  });

  await new Promise((resolve,reject)=>{
    server.once("error",reject);
    server.listen(0,"127.0.0.1",resolve);
  });
  const address=server.address();
  return{
    baseUrl:`http://127.0.0.1:${address.port}`,
    close:()=>new Promise((resolve,reject)=>{
      server.close(error=>error?reject(error):resolve());
    })
  };
}
