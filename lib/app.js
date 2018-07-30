const Koa = require("koa");
const bodyParser = require("koa-bodyparser");
const Router = require("koa-router");

const db = require("./db");
const redis = require("./redis");
const worker = require("./worker");

const router = new Router();

router.get("/", async ctx => {
  ctx.body = "<h1>DDB!</h1>";
});

async function init() {
  const app = new Koa();

  app.use(await redis.init());
  app.use(await db.init());
  app.use(await worker.init());
  app.use(bodyParser());
  app.use(router.routes());
  return app;
}

module.exports = {init, router};
