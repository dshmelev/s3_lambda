'use strict';

var AWS      = require('aws-sdk');
var Promise = require('promise');
var s3Stream = require('s3-upload-stream')(new AWS.S3());
var archiver = require('archiver');
var s3 = new AWS.S3();

exports.handler = function (data, context) => {
  var archive = archiver('zip');

  var upload = s3Stream.upload({
    "Bucket": data.outputBucket,
    "Key": data.outputKey
  });

  archive.pipe(upload);

  var allDonePromise = new Promise(function(resolveAllDone) {
    upload.on('uploaded', function (details) {
      resolveAllDone();
    });
  });

  allDonePromise.then(function() {
    context.done(null, '');
  });

  var getObjectPromises = [];
  for(var i in data.keys) {
    (function(itemKey) {
      itemKey = decodeURIComponent(itemKey).replace(/\+/g,' ');
      var getPromise = new Promise(function(resolveGet) {
        s3.getObject({
          Bucket: data.bucket,
          Key : itemKey
        }, function(err, data) {
          if (err) {
            console.log(itemKey, err, err.stack);
            resolveGet();
          }
          else {
            var itemName = itemKey.substr(itemKey.lastIndexOf('/'));
            archive
              .append(data.Body, { name: itemName });
            resolveGet();
          }
        });
      });
      getObjectPromises.push(getPromise);
    })(data.keys[i]);
  }
  Promise.all(getObjectPromises).then(function() {
    archive.finalize();
  });
};
