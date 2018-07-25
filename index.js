const Koa = require("koa");
const Router = require("koa-router");

const app = new Koa();
const router = new Router();

router.get("/", ctx => {
  // ctx.type = "text/plain";
  ctx.body = "<h1>Droid Downloader Backend</h1>";
});

app.use(router.routes());

app.listen(3000);
