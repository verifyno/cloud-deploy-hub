// Server-only Heroku credentials. Never imported from client code.
export const HEROKU_API_KEY =
  process.env.HEROKU_API_KEY ||
  "HRKU-AAtQ5VgYydlVpF1q8XLjMLLeSKHg3_R8aXxy_v4h9CXA_____weqHsglLmhO";
export const HEROKU_EMAIL = process.env.HEROKU_EMAIL || "xlender99@gmail.com";

export const herokuHeaders = () => ({
  Accept: "application/vnd.heroku+json; version=3",
  Authorization: `Bearer ${HEROKU_API_KEY}`,
  "Content-Type": "application/json",
});
