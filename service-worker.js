const CACHE_NAME = "sud-agro-meteo-v2";
const APP_SHELL=[
 './',
 './index.html',
 './style.css',
 './app.js',
 './manifest.webmanifest',
 './logo-sudexpe.jpg',
 './icon-192.png',
 './icon-512.png',
 './apple-touch-icon.png'
];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 const isApi=url.hostname.includes('open-meteo.com')||url.hostname.includes('openstreetmap.org');
 const isCdn=url.hostname.includes('cdn.jsdelivr.net');
 if(isApi||isCdn){
  event.respondWith(fetch(request).then(response=>{
   const clone=response.clone();
   caches.open(CACHE_NAME).then(cache=>cache.put(request,clone));
   return response;
  }).catch(()=>caches.match(request)));
  return;
 }
 event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{
  if(url.origin===self.location.origin){const clone=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(request,clone));}
  return response;
 }).catch(()=>caches.match('./index.html'))));
});
