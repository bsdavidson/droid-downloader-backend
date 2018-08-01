const path = require("path");
const {Transform} = require("stream");

const debug = require("debug")("ddb:exif");
const ExifImage = require("exif").ExifImage;

function getExifData(file) {
  return new Promise((resolve, reject) => {
    try {
      new ExifImage({image: file}, function(error, exifData) {
        if (error) {
          reject(error);
        } else {
          resolve(exifData);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

class ExifTransform extends Transform {
  constructor(options) {
    super({readableObjectMode: true, writableObjectMode: true, ...options});
  }

  async _transform(chunk, encoding, callback) {
    let exifData;
    let extension = path.extname(chunk.filePath).toUpperCase();
    if (extension !== ".JPG") {
      callback();
      return;
    }
    try {
      exifData = await getExifData(chunk.filePath);
      callback(null, {...chunk, exifData});
    } catch (err) {
      debug("ExifTransform: error (%s): %s", chunk.filePath, err);
      callback();
    }
  }
}

exports.ExifTransform = ExifTransform;
exports.getExifData = getExifData;
