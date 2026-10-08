/* ═══════════════════════════════════════════════════════════════════
   Sacred Water — offline support.

   The people this guide is written for read it where the signal is
   worst: a village build site, a border area, a phone with a few
   hundred kilobytes of credit left. So the page itself is kept in the
   cache, and every step photo that has been fetched once stays
   fetched. A dead link should cost you the latest edit, not the
   instructions you are standing in front of.
   ═══════════════════════════════════════════════════════════════════ */
var VERSION = 'v1';
var SHELL = 'sw-shell-' + VERSION;   /* the page, the fonts */
var IMGS  = 'sw-img-v1';             /* step photos — same name the page prefetches into */
var PAGE  = './index.html';

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(SHELL)
      .then(function(c){ return c.addAll(['./', PAGE]); })
      .catch(function(){})                       /* a failed precache must not block install */
      .then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        if(k !== SHELL && k !== IMGS) return caches.delete(k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch(err){ return; }

  /* The page: take the fresh one when the network allows, keep a copy,
     and fall back to that copy the moment it does not. */
  if(req.mode === 'navigate'){
    e.respondWith(
      fetch(req).then(function(r){
        if(r && r.ok){
          var copy = r.clone();
          caches.open(SHELL).then(function(c){ c.put(PAGE, copy); });
        }
        return r;
      }).catch(function(){
        return caches.match(PAGE).then(function(hit){
          return hit || new Response('<h1>Offline</h1>', {headers:{'Content-Type':'text/html'}});
        });
      })
    );
    return;
  }

  /* Photos never change once published — cache first, forever. */
  if(/\/Images\//.test(url.pathname)){
    e.respondWith(
      caches.match(req, {ignoreVary:true}).then(function(hit){
        if(hit) return hit;
        return fetch(req).then(function(r){
          if(r && r.ok){
            var copy = r.clone();
            caches.open(IMGS).then(function(c){ c.put(req, copy); });
          }
          return r;
        });
      })
    );
    return;
  }

  /* Fonts: show what we have at once, refresh behind the reader's back. */
  if(/fonts\.(googleapis|gstatic)\.com$/.test(url.host)){
    e.respondWith(
      caches.open(SHELL).then(function(c){
        return c.match(req).then(function(hit){
          var net = fetch(req).then(function(r){
            if(r && (r.ok || r.type === 'opaque')) c.put(req, r.clone());
            return r;
          }).catch(function(){ return hit; });
          return hit || net;
        });
      })
    );
  }
});
