import url from "node:url";
import parseURL from "./parseURL.js";
import withCORS from "./withCORS.js";


export default  function onProxyResponse(proxy, proxyReq, proxyRes, req, res) {
  const requestState = req.corsAnywhereRequestState;

  const statusCode = proxyRes.statusCode;

  if (!requestState.redirectCount_) {
    res.setHeader("x-request-url", requestState.location.href);
  }
  if (
    statusCode === 301 ||
    statusCode === 302 ||
    statusCode === 303 ||
    statusCode === 307 ||
    statusCode === 308
  ) {
    let locationHeader = proxyRes.headers.location;
    let parsedLocation;
    if (locationHeader) {
      locationHeader = url.resolve(requestState.location.href, locationHeader);
      parsedLocation = parseURL(locationHeader);
    }
    if (parsedLocation) {
      if (statusCode === 301 || statusCode === 302 || statusCode === 303) {
        requestState.redirectCount_ = requestState.redirectCount_ + 1 || 1;
        if (requestState.redirectCount_ <= requestState.maxRedirects) {
          res.setHeader(
            "X-CORS-Redirect-" + requestState.redirectCount_,
            statusCode + " " + locationHeader
          );

          req.method = "GET";
          req.headers["content-length"] = "0";
          delete req.headers["content-type"];
          requestState.location = parsedLocation;
          req.removeAllListeners();
          proxyReq.removeAllListeners("error");
          proxyReq.once("error", function catchAndIgnoreError() {});
          proxyReq.abort();
          proxyRequest(req, res, proxy);
          return false;
        }
      }
      proxyRes.headers.location =
        requestState.proxyBaseUrl + "/" + locationHeader;
    }
  }

  delete proxyRes.headers["set-cookie"];
  delete proxyRes.headers["set-cookie2"];

  proxyRes.headers["x-final-url"] = requestState.location.href;
  withCORS(proxyRes.headers, req);
  return true;
}

function proxyRequest(req, res, proxy) {
  const location = req.corsAnywhereRequestState.location;
  req.url = location.path;

  const proxyOptions = {
    changeOrigin: false,
    prependPath: false,
    target: location,
    headers: {
      host: location.host,
    },
    buffer: {
      pipe: function (proxyReq) {
        const proxyReqOn = proxyReq.on;
        proxyReq.on = function (eventName, listener) {
          if (eventName !== "response") {
            return proxyReqOn.call(this, eventName, listener);
          }
          return proxyReqOn.call(this, "response", function (proxyRes) {
            if (onProxyResponse(proxy, proxyReq, proxyRes, req, res)) {
              try {
                listener(proxyRes);
              } catch (err) {
                proxyReq.emit("error", err);
              }
            }
          });
        };
        
        proxyReq.on('error', function(err) {
          console.error('Proxy request error:', err);
          
          if (!res.headersSent) {
            res.writeHead(502, 'Bad Gateway');
            res.end('Error connecting to target server: ' + err.message);
          } else {
            // Try to gracefully end the response if possible
            try {
              res.end();
            } catch (e) {
              console.error('Error ending response:', e);
            }
          }
        });
        
        return req.pipe(proxyReq);
      },
    },
  };

  const proxyThroughUrl = req.corsAnywhereRequestState.getProxyForUrl(
    location.href
  );
  if (proxyThroughUrl) {
    proxyOptions.target = proxyThroughUrl;
    proxyOptions.toProxy = true;
    req.url = location.href;
  }
  
  try {
    proxy.web(req, res, proxyOptions);
  } catch (err) {
    console.error('Proxy initialization error:', err);
    
    // Send error response to client
    if (!res.headersSent) {
      res.writeHead(500, 'Internal Server Error');
      res.end('Proxy initialization error: ' + err.message);
    }
  }
}
