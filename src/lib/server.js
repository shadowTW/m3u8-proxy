import dotenv from "dotenv";
import createServer from "./createServer.js";
import colors from "colors";
import createRateLimitChecker from "./createRateLimitChecker.js";

dotenv.config();

const host = process.env.HOST || "127.0.0.1";
const port = process.env.PORT || 8080;
const web_server_url = process.env.PUBLIC_URL || `http://${host}:${port}`;
const rateLimitChecker = createRateLimitChecker(process.env.CORSANYWHERE_RATELIMIT);

export default function server() {
  createServer({
    originBlacklist: ["*"],
    originWhitelist: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",")
      : [],
    requireHeader: [],
    removeHeaders: [
      "cookie",
      "cookie2",
      "x-request-start",
      "x-request-id",
      "via",
      "connect-time",
      "total-route-time",
    ],
    redirectSameOrigin: true,
    checkRateLimit: rateLimitChecker,
    httpProxyOptions: {
      xfwd: false,
    },
  }).listen(port, Number(host), function () {
    console.log(
      colors.green("Server running on ") + colors.blue(`${web_server_url}`)
    );
  });
}

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  // console log is optional
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // same here
});
