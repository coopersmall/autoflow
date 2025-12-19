import * as github from "@actions/github";
import * as core from "@actions/core";

async function run() {
  const issueNumber = core.getInput("issue_number");
  const token = core.getInput("token");
  const octokit = github.getOctokit(token);
  const context = github.context;

  const response = await octokit.rest.issues.listComments({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: issueNumber,
  });

  const checklistComment = response.data.find((comment) =>
    comment.body.includes("## Required Acknowledgements"),
  );

  if (!checklistComment) {
    core.setFailed(
      "Required Checklist Missing - Could not find the required acknowledgements checklist in the PR comments.",
    );
    return;
  }

  const uncheckedBoxes = (checklistComment.body.match(/\[ \]/g) || []).length;
  if (uncheckedBoxes > 0) {
    core.setFailed(
      `Missing Checklist Items - Found ${uncheckedBoxes} unchecked item${uncheckedBoxes > 1 ? "s" : ""} in the PR checklist.`,
    );
    return;
  }

  core.info(
    "Checklist Complete - All required checklist items have been completed.",
  );
}

await run();
