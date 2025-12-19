import * as github from "@actions/github";
import * as core from "@actions/core";

const checkName = "Label Verification";

async function run({ context, octokit }, sha, labels, requiredLabels) {
  const check = await octokit.rest.checks.create({
    owner: context.repo.owner,
    repo: context.repo.repo,
    name: checkName,
    head_sha: sha,
    status: "in_progress",
  });

  if (!labels || labels.length === 0) {
    await octokit.rest.checks.update({
      owner: context.repo.owner,
      repo: context.repo.repo,
      check_run_id: check.data.id,
      status: "completed",
      conclusion: "failure",
      output: {
        title: "No Labels Found",
        summary: "The PR has no labels.",
        text: "Please add one of the required labels to categorize this PR appropriately.",
      },
    });
    return;
  }

  const matchingLabels = requiredLabels.filter((required) =>
    labels.includes(required.toLowerCase()),
  );

  if (matchingLabels.length === 0) {
    await octokit.rest.checks.update({
      owner: context.repo.owner,
      repo: context.repo.repo,
      check_run_id: check.data.id,
      status: "completed",
      conclusion: "failure",
      output: {
        title: "Missing Required Label",
        summary: `PR must have one of these labels: ${requiredLabels.join(", ")}`,
        text: "Please add one of the required labels to categorize this PR appropriately.",
      },
    });
    return;
  }

  if (matchingLabels.length > 1) {
    await octokit.rest.checks.update({
      owner: context.repo.owner,
      repo: context.repo.repo,
      check_run_id: check.data.id,
      status: "completed",
      conclusion: "failure",
      output: {
        title: "Multiple Conflicting Labels",
        summary: `PR cannot have multiple labels from: ${requiredLabels.join(", ")}`,
        text: `Current matching labels: ${matchingLabels.join(", ")}. Please remove all but one of these labels.`,
      },
    });
    return;
  }

  await octokit.rest.checks.update({
    owner: context.repo.owner,
    repo: context.repo.repo,
    check_run_id: check.data.id,
    status: "completed",
    conclusion: "success",
    output: {
      title: "Labels Verified",
      summary: `PR has the correct label: ${matchingLabels[0]}`,
      text: "The PR is properly labeled with exactly one of the required labels.",
    },
  });
}

const sha = core.getInput("sha");
const labels = core.getInput("labels");
const parsed = labels
  ? JSON.parse(labels).map((label) => label.toLowerCase())
  : [];
const requiredLabels = core
  .getInput("required_labels")
  .split(",")
  .map((label) => label.toLowerCase());

const context = github.context;
const octokit = github.getOctokit(core.getInput("token"));

await run({ context, octokit }, sha, parsed, requiredLabels);
