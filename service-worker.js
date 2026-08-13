const CACHE_NAME = "sam-indic-v8-double-logo";
const APP_SHELL=[
 "./",
 "./index.html",
 "./style.css",
 "./app.js",
 "./manifest.webmanifest",
 "./logo-sudexpe.png",
 "./icon-192.png",
 "./icon-512.png",
 "./apple-touch-icon.png",
 "./app-icon.png"
];

self.addEventListener("install",event=>{
 event.waitUntil(
  caches.open(CACHE_NAME)
   .then(cache=>cache.addAll(APP_SHELL))
   .then(()=>self.skipWaiting())
 );
});

self.addEventListener("activate",event=>{
 event.waitUntil(
  caches.keys()
   .then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key))))
   .then(()=>self.clients.claim())
 );
});

self.addEventListener("fetch",event=>{
 const request=event.request;
 if(request.method!=="GET")return;

 const url=new URL(request.url);
 const isExternalApi=
  url.hostname.includes("open-meteo.com")||
  url.hostname.includes("openstreetmap.org");
 const isCdn=url.hostname.includes("cdn.jsdelivr.net");

 if(isExternalApi||isCdn){
  event.respondWith(
   fetch(request)
    .then(response=>{
     const clone=response.clone();
     caches.open(CACHE_NAME).then(cache=>cache.put(request,clone));
     return response;
    })
    .catch(()=>caches.match(request,{ignoreSearch:true}))
  );
  return;
 }

 // Network-first pour les fichiers de l'application :
 // une mise à jour GitHub est récupérée dès qu'Internet est disponible.
 event.respondWith(
  fetch(request)
   .then(response=>{
    if(url.origin===self.location.origin){
     const clone=response.clone();
     caches.open(CACHE_NAME).then(cache=>cache.put(request,clone));
    }
    return response;
   })
   .catch(async()=>{
    const cached=await caches.match(request,{ignoreSearch:true});
    return cached||caches.match("./index.html");
   })
 );
});
