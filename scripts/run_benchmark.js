#!/usr/bin/env node

var arg, argv = process.argv.slice(2), match, val;

var options = {
    port: 8079,
    file: "file.txt",
    child: false,
    filesize: 4096,
    concurrency: 20,
    requests: 1000
};

var shortOptionMap =
    { 'p' : 'port', 'f' : 'file', 's': 'filesize', 'c' : 'concurrency',
      'n': 'requests' };

while ((arg = argv.shift())) {
    if ((match = arg.match(/^--?(.+)/))) {
        arg = match[1];
        arg = shortOptionMap[arg] || arg;

        if (arg in options) {
            val = argv[0][0] !== '-' ? argv.shift() : true;
            options[arg] = /^[0-9]+$/.test(val) ? parseInt(val) : val;
        }
        else throw new Error("unknown option " + arg);
    }
}

var sys = require('sys');
var cp  = require('child_process');

require.paths.unshift('./lib');


var st = require('node-static');
var fs = require('fs');

var file = options.file;
var filesize = options.filesize;
var port = options.port;

// Create a directory to be served
var directory = "node-static-benchmark-" + process.pid;

fs.mkdirSync(directory, 0700);

// Put a file in the directory (do it synchronously since we don't need to
// deal with the async stuff in setup).

var filepath = directory + "/" + file;

var fd = fs.openSync(filepath, "w");

function cleanup()
{
    fs.close(fd);
    fs.unlinkSync(filepath);
    fs.rmdirSync(directory);
}

// Make sure that we clean up at the end
process.on('exit', cleanup);

for (var i = 0;  i < filesize / 64;  ++i) {
    fs.writeSync(fd, "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.,");
}

fs.close(fd);

// Set up node-static
var server = new st.Server(directory);

// Set up a listener on our port

function onRequest(request, response)
{
    function onRequestEnd()
    {
        server.serve(request, response);
    }

    request.addListener('end', onRequestEnd);
}

require('http').createServer(onRequest).listen(port);

sys.puts("Listening on 127.0.0.1:" + options.port);

function finishedTest(error, stdout, stderr)
{
    sys.puts("finished test");
    stdout && sys.puts("stdout:", stdout);
    stderr && sys.puts("stderr:", stderr);
    error && sys.puts("error:", error.message, error.killed, error.code, error.signal);

    process.exit(1);
}

// Spawn the testing process
var ab = cp.exec("ab -n " + options.requests + " -c " + options.concurrency
                 + " http://localhost:" + port + "/" + file,
                 finishedTest);

sys.puts("running test");
