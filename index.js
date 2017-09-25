'use strict';

var Promise  = require('promise');
var archiver = require('archiver');
var AWS      = require('aws-sdk');
var s3Stream = require('s3-upload-stream')(new AWS.S3());
var s3       = new AWS.S3()

exports.handler = function (params, context) {
    var archive = archiver('zip');
    var objectKeys = [];

    var upload = s3Stream.upload({
        "Bucket": params.outputBucket,
        "Key": params.outputKey
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

    console.log("ListObjects: " + params.inputBucket )
    var listPromise = new Promise(function(resolveList) {
        s3.listObjects({
            Bucket: params.inputBucket,
        }, function(err, data) {
            if (err) {
                console.log(err, err.stack);
            } else {
                objectKeys = data.Contents;
                resolveList();
            }
        })
    });

    listPromise.then(function() {
        for(var i in objectKeys) {
            (function(item) {
                console.log("GetObject: " + item.Key)
                var getPromise = new Promise(function(resolveGet) {
                    s3.getObject({
                        Bucket: params.inputBucket,
                        Key:    item.Key,
                    }, function(err, data) {
                        if (err) {
                            console.log(item.Key, err, err.stack);
                        } else {
                            console.log("ArchiveObject: " + item.Key);
                            archive.append(data.Body, { name: item.Key });
                            resolveGet();
                        }
                    });
                })
                getObjectPromises.push(getPromise);
            })(objectKeys[i]);
        }
        Promise.all(getObjectPromises).then(function() {
            console.log("ArchveFinalize");
            archive.finalize();
        });
    });
};

exports.handler({
    inputBucket:  "s3lambda-data",
    outputBucket: "s3lambda-backup",
    outputKey:    "backup-node.zip",
})
