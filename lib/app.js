const Koa = require("koa");
const Router = require("koa-router");
const bodyParser = require("koa-bodyparser");

const db = require("./db");
const redis = require("./redis");

const router = new Router();

router.get("/", async ctx => {
  ctx.body = await db.File.findAll();
});

async function init() {
  const app = new Koa();
  app.use(await redis.init());
  app.use(await db.init());
  app.use(bodyParser());
  app.use(router.routes());
  return app;
}

module.exports = {init, router};
