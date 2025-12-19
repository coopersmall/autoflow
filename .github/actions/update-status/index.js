import * as github from "@actions/github";
import * as core from "@actions/core";

async function run({ context, octokit }, checkId, outcome) {
  const conclusion = outcome === "success" ? "success" : "failure";
  await octokit.rest.checks.update({
    owner: context.repo.owner,
    repo: context.repo.repo,
    check_run_id: checkId,
    status: "completed",
    conclusion: conclusion,
    output: {
      title: "Result",
      summary: conclusion === "success" ? "Success" : "Failure",
    },
  });
}

const checkId = core.getInput("check_id");
const outcome = core.getInput("outcome");
const context = github.context;
const octokit = github.getOctokit(core.getInput("token"));

await run({ context, octokit }, checkId, outcome);
