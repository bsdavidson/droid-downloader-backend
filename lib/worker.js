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

class RedisFilesWritable extends Writable {
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
      console.warn(
        `worker.RedisFilesWritable: error (${chunk.filePath}): ${err}`
      );
    }
    callback();
  }
}

function convertGPSData(direction, deg, min = 0, sec = 0) {
  let result = deg + min / 60 + sec / 3600;
  if (direction === "S" || direction === "W") {
    return -result;
  }
  return result;
}

class RedisFileGeosWritable extends Writable {
  constructor(options) {
    super({objectMode: true, ...options});
  }

  async _write(chunk, encoding, callback) {
    try {
      const lat = convertGPSData(
        chunk.exifData.gps.GPSLatitudeRef,
        ...chunk.exifData.gps.GPSLatitude
      );
      const lon = convertGPSData(
        chunk.exifData.gps.GPSLongitudeRef,
        ...chunk.exifData.gps.GPSLongitude
      );

      await redis.conn.geoadd("filegeos", lon, lat, chunk.filePath);
    } catch (err) {
      console.warn(
        `worker.RedisFilesWritable: error (${chunk.filePath}): ${err}`
      );
    }
    callback();
  }
}

class RedisFileTimesWritable extends Writable {
  constructor(options) {
    super({objectMode: true, ...options});
  }

  async _write(chunk, encoding, callback) {
    callback();
    const writeTime = Date.now().toString();
    try {
      await redis.conn.zadd("filetimes", writeTime, chunk);
    } catch (err) {
      console.warn(
        `worker.RedisFileTimesWritable: error (${chunk}, ${writeTime}): ${err}`
      );
    }
  }
}

function monitorPath(path) {
  if (!path) {
    return;
  }
  console.log(`worker.monitorPath: monitoring: ${process.env.DDB_ROOT_DIR}`);
  const dirs = new Readable({objectMode: true, read() {}});
  const exify = new ExifTransform();
  const redisFilesWriter = new RedisFilesWritable();
  const redisFileTimesWriter = new RedisFileTimesWritable();
  const redisFileGeosWritable = new RedisFileGeosWritable();
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
  dirContentTransform.pipe(redisFileTimesWriter);

  statTransform.pipe(dirSelector).pipe(dirContentTransform);
  statTransform.pipe(fileSelector).pipe(exify);

  exify.pipe(redisFilesWriter);
  exify.pipe(redisFileGeosWritable);

  dirs.push(path);
}

function init() {
  monitorPath(process.env.DDB_ROOT_DIR);

  return async (ctx, next) => {
    await next(ctx);
  };
}

module.exports = {init};
