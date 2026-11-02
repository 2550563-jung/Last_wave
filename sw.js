// Network first, so players always get the latest release when online.
// Responses are cached to let the game start offline.
const CACHE="last-wave-offline-v1";
const CDN_ORIGIN="https://cdn.jsdelivr.net";

self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    for(const name of await caches.keys())if(name!==CACHE)await caches.delete(name);
    await self.clients.claim();
  })());
});
self.addEventListener("fetch",event=>{
  const {request}=event,url=new URL(request.url);
  if(request.method!=="GET"||(url.origin!==location.origin&&url.origin!==CDN_ORIGIN))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    try{
      const response=await fetch(request);
      if(response.ok)await cache.put(request,response.clone());
      return response;
    }catch(error){
      const cached=await cache.match(request)||(request.mode==="navigate"?await cache.match("./"):null);
      if(cached)return cached;
      throw error;
    }
  })());
});
