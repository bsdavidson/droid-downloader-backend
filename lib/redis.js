const Redis = require("ioredis");

const conn = new Redis({
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  host: process.env.REDIS_HOST || "127.0.0.1",
  family: 4, // 4 (IPv4) or 6 (IPv6)
  db: 0
});

async function init() {
  await conn.ping();
  return (ctx, next) => next();
}

module.exports = {conn, init};
