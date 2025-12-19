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
    await core.summary
      .addHeading("Required Checklist Missing", 2)
      .addRaw(
        "Could not find the required acknowledgements checklist in the PR comments.",
      )
      .write();
    core.error(
      "Could not find the required acknowledgements checklist in the PR comments.",
      { title: "Required Checklist Missing" },
    );
    process.exit(1);
  }

  const uncheckedBoxes = (checklistComment.body.match(/\[ \]/g) || []).length;
  if (uncheckedBoxes > 0) {
    await core.summary
      .addHeading("Missing Checklist Items", 2)
      .addRaw(
        `Found ${uncheckedBoxes} unchecked item${uncheckedBoxes > 1 ? "s" : ""} in the PR checklist. Please complete all required acknowledgements.`,
      )
      .write();
    core.error(
      `Found ${uncheckedBoxes} unchecked item${uncheckedBoxes > 1 ? "s" : ""} in the PR checklist.`,
      { title: "Missing Checklist Items" },
    );
    process.exit(1);
  }

  await core.summary
    .addHeading("Checklist Complete", 2)
    .addRaw("All required checklist items have been completed.")
    .write();
  core.info(
    "Checklist Complete - All required checklist items have been completed.",
  );
}

await run();
