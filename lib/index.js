const {init} = require("./app");

async function main() {
  const app = await init();
  app.listen(3000);
}

main();
