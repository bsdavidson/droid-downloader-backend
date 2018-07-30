const {Writable, Readable} = require("stream");

const db = require("./db");
const {ExifTransform} = require("./exif");
const {
  DirContentTransform,
  SelectTransform,
  StatTransform
} = require("./files");
const redis = require("./redis");

class PostgresWritable extends Writable {
  constructor(options) {
    super({objectMode: true, ...options});
  }

  async _write(chunk, encoding, callback) {
    try {
      const file = await db.File.find({
        where: {
          path: chunk.filePath
        }
      });

      if (!file) {
        await db.File.create({
          path: chunk.filePath,
          stats: chunk.stats,
          exif: chunk.exifData
        });
      } else if (file.stats.mtimeMs !== chunk.stats.mtimeMs) {
        await file.update(chunk);
      }
    } catch (err) {
      console.warn(
        `worker.PostgresWritable: error (${chunk.filePath}): ${err}`
      );
    }

    callback();
  }
}

class RedisWritable extends Writable {
  constructor(options) {
    super({objectMode: true, ...options});
  }

  async _write(chunk, encoding, callback) {
    try {
      const file = await redis.conn.hget("files", chunk.filePath);

      if (!file || JSON.parse(file).stats.mtimeMs !== chunk.stats.mtimeMs) {
        await redis.conn.hset("files", chunk.filePath, JSON.stringify(chunk));
      }
    } catch (err) {
      console.warn(`worker.RedisWritable: error (${chunk.filePath}): ${err}`);
    }
    callback();
  }
}

function monitorPath(path) {
  if (!path) {
    return;
  }
  const dirs = new Readable({objectMode: true, read() {}});
  const exify = new ExifTransform();
  const redisWriter = new RedisWritable();
  const postgresWriter = new PostgresWritable();

  const dirContentTransform = new DirContentTransform();
  const dirSelector = new SelectTransform({
    select: item => item.stats.isDirectory(),
    map: item => item.filePath
  });
  const fileSelector = new SelectTransform({
    select: item => item.stats.isFile()
  });
  const statTransform = new StatTransform();

  dirs.pipe(dirContentTransform);
  dirContentTransform.pipe(statTransform);
  statTransform.pipe(dirSelector).pipe(dirContentTransform);
  statTransform
    .pipe(fileSelector)
    .pipe(exify)
    .pipe(redisWriter);

  dirs.push(path);
}

function init() {
  monitorPath(process.env.DDB_ROOT_DIR);

  return async (ctx, next) => {
    await next(ctx);
  };
}

module.exports = {init};
