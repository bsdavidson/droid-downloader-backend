const fs = require("fs");
const path = require("path");
const {Transform} = require("stream");

class DirContentTransform extends Transform {
  constructor(options) {
    super({readableObjectMode: true, writableObjectMode: true, ...options});
  }

  _transform(dir, encoding, callback) {
    fs.readdir(dir, (err, names) => {
      if (err) {
        console.warn(`files.DirContentTransform: error (${dir}): ${err}`);
        callback();
        return;
      }
      names.forEach(name => {
        this.push(path.join(dir, name));
      });
      callback();
    });
  }
}

class StatTransform extends Transform {
  constructor(options) {
    super({readableObjectMode: true, writableObjectMode: true, ...options});
  }

  _transform(filePath, encoding, callback) {
    fs.lstat(filePath, (err, stats) => {
      if (err) {
        console.log(`files.StatTransform: error (${filePath}): ${err}`);
        callback();
        return;
      }
      callback(null, {filePath, stats});
    });
  }
}

class SelectTransform extends Transform {
  constructor(options) {
    super({readableObjectMode: true, writableObjectMode: true, ...options});

    this.select = options.select;
    this.map = options.map;
  }

  _transform(item, encoding, callback) {
    if (this.select && !this.select(item)) {
      callback();
      return;
    }

    callback(null, this.map ? this.map(item) : item);
  }
}

exports.DirContentTransform = DirContentTransform;
exports.SelectTransform = SelectTransform;
exports.StatTransform = StatTransform;
