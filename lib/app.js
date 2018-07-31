const path = require("path");

const Koa = require("koa");
const bodyParser = require("koa-bodyparser");
const Router = require("koa-router");
const serve = require("koa-static");

const db = require("./db");
const redis = require("./redis");
const worker = require("./worker");

const router = new Router();

router.get("/api/files", async ctx => {
  const files = await redis.conn.hgetall("files");
  delete files._id;

  const data = Object.keys(files).map(k => {
    return JSON.parse(files[k]);
  });

  ctx.body = data;
});

async function init() {
  const app = new Koa();

  app.use(await redis.init());
  app.use(await db.init());
  app.use(await worker.init());
  app.use(bodyParser());
  app.use(serve(path.join(__dirname, "..", "web", "build")));
  app.use(router.routes());
  return app;
}

module.exports = {init, router};
