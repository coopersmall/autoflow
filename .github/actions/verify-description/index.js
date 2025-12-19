import * as core from "@actions/core";

async function run() {
  const prBody = core.getInput("pr_body");

  const whatHeaderRegex = /^#+\s*What\s*$/m;
  if (!whatHeaderRegex.test(prBody)) {
    core.setFailed(
      'Missing "What" Section - Please add a "What" section to your PR description (# What, ## What, or ### What).',
    );
    return;
  }

  const testingHeaderRegex = /^#+\s*Testing\s*$/m;
  if (!testingHeaderRegex.test(prBody)) {
    core.setFailed(
      'Missing "Testing" Section - Please add a "Testing" section to your PR description (# Testing, ## Testing, or ### Testing).',
    );
    return;
  }

  core.info(
    "PR Description Format Verified - All required sections are present.",
  );
}

await run();
