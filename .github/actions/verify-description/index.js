import * as github from "@actions/github";
import * as core from "@actions/core";

const checkName = "Description Verification";

async function run({ context, octokit }, prBody, sha) {
  const check = await octokit.rest.checks.create({
    owner: context.repo.owner,
    repo: context.repo.repo,
    name: checkName,
    head_sha: sha,
    status: "in_progress",
  });

  const whatHeaderRegex = /^#+\s*What\s*$/m;
  if (!whatHeaderRegex.test(prBody)) {
    await octokit.rest.checks.update({
      owner: context.repo.owner,
      repo: context.repo.repo,
      check_run_id: check.data.id,
      status: "completed",
      conclusion: "failure",
      output: {
        title: 'Missing "What" Section',
        summary: 'The PR description is missing a "What" header.',
        text:
          'Please add a "What" section to your PR description using one of these formats:\n' +
          "- # What\n" +
          "- ## What\n" +
          "- ### What\n\n" +
          "This section should describe what changes are being made in this PR.",
      },
    });
    return;
  }

  const testingHeaderRegex = /^#+\s*Testing\s*$/m;
  if (!testingHeaderRegex.test(prBody)) {
    await octokit.rest.checks.update({
      owner: context.repo.owner,
      repo: context.repo.repo,
      check_run_id: check.data.id,
      status: "completed",
      conclusion: "failure",
      output: {
        title: 'Missing "Testing" Section',
        summary: 'The PR description is missing a "Testing" header.',
        text:
          'Please add a "Testing" section to your PR description using one of these formats:\n' +
          "- # Testing\n" +
          "- ## Testing\n" +
          "- ### Testing\n\n" +
          "This section should describe how to test the changes in this PR.",
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
      title: "PR Description Format Verified",
      summary: "All required sections are present in the PR description.",
      text:
        "The PR description contains both required sections:\n" +
        '- "What" section ✓\n' +
        '- "Testing" section ✓',
    },
  });
}

const prBody = core.getInput("pr_body");
const sha = core.getInput("sha");
const context = github.context;
const octokit = github.getOctokit(core.getInput("token"));

await run({ context, octokit }, prBody, sha);
