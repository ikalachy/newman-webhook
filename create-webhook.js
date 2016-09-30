const GitHubApi = require("github");
const github = new GitHubApi();

// Use a token created for us so that we can update the status
github.authenticate({
    type: "token",
    token: process.env.GITHUB_TOKEN
});

github.repos.createHook({
    user: process.env.REPO_OWNER,
    repo: process.env.REPO_NAME,
    name: "web",
    active: true,
    config: {
        url: `https://${process.env.WEBHOOK_APP_NAME}.herokuapp.com/webhook`,
        content_type: "json",
        secret: process.env.GITHUB_SECRET
    },
    events: ["deployment_status"]
}, function(err, res) {
    if(err) {
        console.error("Failed to create webhook:", err);
    } else {
        console.log("Created webhook: ", res);
    }
});