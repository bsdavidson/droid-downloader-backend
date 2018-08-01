const fs = require("fs");
const path = require("path");

const debug = require("debug")("ddb:db");
const Sequelize = require("sequelize");

function getPassword() {
  const paths = [
    path.join(`${path.sep}run`, "secrets", "postgres-password"),
    path.join(__dirname, "..", "secrets", "postgres-password")
  ];

  for (const p of paths) {
    try {
      return fs.readFileSync(p).toString();
    } catch (err) {
      if (err.code !== "ENOENT") {
        throw err;
      }
    }
  }
  throw new Error("postgres-password file not found");
}

const conn = new Sequelize(
  process.env.POSTGRES_DB || "ddb",
  process.env.POSTGRES_USER || "ddb",
  getPassword(),
  {
    host: process.env.POSTGRES_HOST || "127.0.0.1",
    dialect: "postgres",
    operatorsAliases: false,
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

const File = conn.define("files", {
  path: {
    type: Sequelize.STRING,
    unique: true
  },
  exif: {
    type: Sequelize.JSONB
  },
  stats: {
    type: Sequelize.JSON
  }
});

async function init() {
  try {
    await conn.sync();
    debug("init: initialized");
  } catch (err) {
    debug("init: error: %s", err);
  }

  return async (ctx, next) => {
    ctx.db = conn;
    await next(ctx);
  };
}

module.exports = {conn, File, init};
