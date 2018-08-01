const fs = require("fs");
const os = require("os");
const path = require("path");
const {Writable, Readable, Transform} = require("stream");

const debug = require("debug")("ddb:worker");
const sharp = require("sharp");

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
      debug("PostgresWritable: error (%s): %s", chunk.filePath, err);
    }

    callback();
  }
}

class RedisFilesTransform extends Transform {
  constructor(options) {
    super({readableObjectMode: true, writableObjectMode: true, ...options});
  }

  async _transform(chunk, encoding, callback) {
    try {
      const file = await redis.conn.hget("files", chunk.fileID);

      if (!file || JSON.parse(file).stats.mtimeMs !== chunk.stats.mtimeMs) {
        await redis.conn.hset("files", chunk.fileID, JSON.stringify(chunk));
        this.push(chunk);
      }
    } catch (err) {
      debug("RedisFilesTransform: error (%s): %s", chunk.filePath, err);
    }
    callback();
  }
}

class RedisFileIDsTransform extends Transform {
  constructor(options) {
    super({readableObjectMode: true, writableObjectMode: true, ...options});
  }

  async _transform(chunk, encoding, callback) {
    try {
      let fileID = await redis.conn.hget("fileids", chunk.filePath);
      if (!fileID) {
        fileID = (await redis.conn.hincrby("files", "_id", 1)).toString();
        const ok = await redis.conn.hsetnx("fileids", chunk.filePath, fileID);
        if (!ok) {
          // Another worker raced us to the set, so get that value instead.
          fileID = await redis.conn.hget("fileids", chunk.filePath);
        }
      }
      if (!fileID) {
        throw new Error(`Couldn't allocate ID for ${chunk.filePath}`);
      }
      this.push({...chunk, fileID});
    } catch (err) {
      debug("RedisFileIDsTransform: error (%s): %s", chunk.filePath, err);
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
      await redis.conn.geoadd("filegeos", lon, lat, chunk.fileID);
    } catch (err) {
      debug("RedisFileGeosWritable: error (%s): %s", chunk.filePath, err);
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
      debug("RedisFileTimesWritable: error (%s): %s", chunk.filePath, err);
    }
  }
}

class ThumbnailWritable extends Writable {
  constructor(thumbnailsPath, options) {
    super({objectMode: true, ...options});

    this.thumbnailsPath = thumbnailsPath;

    try {
      fs.mkdirSync(this.thumbnailsPath, 0o755);
    } catch (err) {
      if (err.code !== "EEXIST") {
        throw err;
      }
    }
    debug("ThumbnailWritable: thumbnail path: %s", this.thumbnailsPath);
  }

  async _write(chunk, encoding, callback) {
    try {
      const thumbnailImagePath = path.join(
        this.thumbnailsPath,
        `${chunk.fileID}${path.extname(chunk.filePath)}`
      );
      sharp(chunk.filePath)
        .rotate()
        .resize(null, 200)
        .toFile(thumbnailImagePath, function(err) {
          if (err) {
            debug("ThumbnailWritable: error (%s): %s", chunk.filePath, err);
          }
          callback();
        });
    } catch (err) {
      debug("ThumbnailWritable: error (%s): %s", chunk.filePath, err);
      callback();
    }
  }
}

function monitorPath(path, thumbnailsPath) {
  if (!path) {
    throw new Error("worker.monitorPath: no root path set");
  }

  debug("monitorPath: monitoring: %s", path);
  const dirs = new Readable({objectMode: true, read() {}});
  const exify = new ExifTransform();
  const redisFileIDsTransform = new RedisFileIDsTransform();
  const redisFilesWriter = new RedisFilesTransform();
  const redisFileTimesWriter = new RedisFileTimesWritable();
  const redisFileGeosWritable = new RedisFileGeosWritable();
  const thumbnailWritable = new ThumbnailWritable(thumbnailsPath);
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
    .pipe(redisFileIDsTransform)
    .pipe(redisFilesWriter);

  redisFilesWriter.pipe(thumbnailWritable);
  redisFilesWriter.pipe(redisFileGeosWritable);
  redisFilesWriter.pipe(redisFileTimesWriter);

  dirs.push(path);
}

function init(rootPath, thumbnailsPath) {
  monitorPath(rootPath, thumbnailsPath);

  return (ctx, next) => next(ctx);
}

module.exports = {init};
