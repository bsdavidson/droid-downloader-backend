const {init} = require("./app");

async function main() {
  const app = await init();
  app.listen(5000);
}

main();
