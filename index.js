const http = require('http');
const newman = require("newman");


// All ready, lets start up the server
http.createServer(function (req, res) {
    handler(req, res, function (err) {
        // handles unknown message types


        // Newman will run the tests in our postman collection
        // found at the specified URL. So that the tests can
        // run against any URL, we pass in the URL we worked
        // out above as a global variable
        newman.run({
            collection: process.env.TESTS_COLLECTION_URL,
            globals: {  },
            reporters: "cli" // for now, just write the test output to the logs
        }, function (err, summary) {
            if(err || summary.error) {
                // Something happened, so we need to create an error status to reflect that
                console.error("Failed to run tests", err);
                //createStatus(event.payload, "error", "Failed to run tests: " + err ? err.message : summary.error);
            } else if(summary.run.failures.length > 0) {
                // Some of the tests failed. More details can be found in the logs,
                // So just create a failure status to provide the number of tests that failed
                console.log("tests failed with " + summary.run.failures.length + " failure(s)");
                //createStatus(event.payload, "failure", "Tests failed with " + summary.run.failures.length + " failure(s)");
            } else {
                // Tests passed! Create a success status
                console.log("tests completed with no failures");
                //createStatus(event.payload, "success", "Tests completed with no failures");
            }
        });

        res.statusCode = 404;
        res.end('no such location');
    });
}).listen(process.env.PORT);