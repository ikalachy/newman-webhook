const http = require('http');
const createHandler = require('github-webhook-handler');
const newman = require("newman");
const GitHubApi = require("github");

const handler = createHandler({ path: '/webhook', secret: process.env.GITHUB_SECRET });
const context = process.env.GITHUB_STATUS_CONTEXT;
var github = new GitHubApi();

// Use a token created for us so that we can update the status
github.authenticate({
    type: "token",
    token: process.env.GITHUB_TOKEN
});

// Log any errors that occur
handler.on('error', function (err) {
  console.error('Error:', err.message);
});

// updates the status for the SHA associated with the deployment_status event.
// GitHub relies on the context to be unique. New statuses with the same context
// as a previous status will replace that previous status.
function createStatus(payload, state, description) {
    github.repos.createStatus({
        user: payload.repository.owner.login,
        repo: payload.repository.name,
        sha: payload.deployment.sha,
        state,
        description,
        context
    });
}

handler.on('deployment_status', function (event) {
    // need to figure out the URL of the app to run tests against.
    // The environment will be the app name for non-review-app deployments,
    // but for review apps it will be if the format <app name>-pr-<PR number>.
    // Don't worry about custom domains for now.
    const base_url = `https://${event.payload.deployment.environment}.herokuapp.com`;
    const state = event.payload.deployment_status.state;

    if(state === "pending") {
        // We want to show up on the PR, so we create a pending status and
        // wait for the next update
        console.log("Deployment still on-going");
        createStatus(event.payload, "pending", "Waiting for deployment to complete");
    } else if (state === "error" || state === "failure") {
        // Can't run the tests if the deployment failed, so create an error status
        console.error("Failed to carry out deployment");
        createStatus(event.payload, "error", "Deployment failed");
    } else {
        // Deployment was successful, but we've still got tests to run,
        // so update our pending status description
        console.log("Deployment successful, starting tests...");
        createStatus(event.payload, "pending", "Running tests...");

        // Newman will run the tests in our postman collection
        // found at the specified URL. So that the tests can
        // run against any URL, we pass in the URL we worked
        // out above as a global variable
        newman.run({
            collection: process.env.TESTS_COLLECTION_URL,
            globals: { base_url },
            reporters: "cli" // for now, just write the test output to the logs
        }, function (err, summary) {
            if(err || summary.error) {
                // Something happened, so we need to create an error status to reflect that
                console.error("Failed to run tests", err);
                createStatus(event.payload, "error", "Failed to run tests: " + err ? err.message : summary.error);
            } else if(summary.run.failures.length > 0) {
                // Some of the tests failed. More details can be found in the logs,
                // So just create a failure status to provide the number of tests that failed
                console.log("tests failed with " + summary.run.failures.length + " failure(s)");
                createStatus(event.payload, "failure", "Tests failed with " + summary.run.failures.length + " failure(s)");
            } else {
                // Tests passed! Create a success status
                console.log("tests completed with no failures");
                createStatus(event.payload, "success", "Tests completed with no failures");
            }
        });
    }
});

// All ready, lets start up the server
http.createServer(function (req, res) {
    handler(req, res, function (err) {
        // handles unknown message types
        res.statusCode = 404;
        res.end('no such location');
    });
}).listen(process.env.PORT);