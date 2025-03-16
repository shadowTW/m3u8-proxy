import https from "node:https";
import http from "node:http";

export async function proxyTs(url, headers, req, res) {
  let forceHTTPS = false;

  if (url.startsWith("https://")) {
    forceHTTPS = true;
  }

  const uri = new URL(url);
  const options = {
    hostname: uri.hostname,
    port: uri.port,
    path: uri.pathname + uri.search,
    method: req.method,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36",
        ...headers,
    },
    timeout: 10000, // 10 seconds
  };
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "*");

  try {
    let proxy;
    
    if (forceHTTPS) {
      proxy = https.request(options);
    } else {
      proxy = http.request(options);
    }
    
    // Comprehensive error handling for the proxy request
    proxy.on('error', (err) => {
      console.error(`Proxy error for ${url}:`, err.message);
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: 'Proxy connection failed', 
          message: err.message,
          code: err.code
        }));
      } else {
        try {
          res.end();
        } catch (e) {
          console.error('Error ending response:', e);
        }
      }
    });
    
    proxy.on('response', (r) => {
      try {
        r.headers["content-type"] = "video/mp2t";
        res.writeHead(r.statusCode ?? 200, r.headers);

        r.pipe(res, {
          end: true
        });
        
        r.on('error', (err) => {
          // console.error(`Response stream error for ${url}:`, err.message);
          try {
            if (!res.finished) {
              res.end();
            }
          } catch (e) {
            console.error('Error ending response after stream error:', e);
          }
        });
      } catch (err) {
        console.error(`Error handling response for ${url}:`, err.message);
        if (!res.finished) {
          try {
            res.end();
          } catch (e) {
            console.error('Error ending response after handling error:', e);
          }
        }
      }
    });

    req.on('error', (err) => {
      console.error(`Source request error for ${url}:`, err.message);
      try {
        proxy.abort();
      } catch (e) {
        console.error('Error aborting proxy:', e);
      }
    });


    req.pipe(proxy, {
      end: true
    });
    
  } catch (e) {
    console.error('Error creating proxy request:', e.message);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: 'Internal server error', 
        message: e.message 
      }));
    }
  }
}