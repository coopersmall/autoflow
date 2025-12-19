import * as github from "@actions/github";
import * as core from "@actions/core";

async function run({ context, octokit }, name, sha, setOutput) {
  const check = await octokit.rest.checks.create({
    owner: context.repo.owner,
    repo: context.repo.repo,
    name,
    head_sha: sha,
    status: "in_progress",
  });
  setOutput(check.data.id);
}

const name = core.getInput("name");
const sha = core.getInput("sha");
const setOutput = function (id) {
  core.setOutput("check_id", id);
};

const context = github.context;
const octokit = github.getOctokit(core.getInput("token"));

await run({ context, octokit }, name, sha, setOutput);
