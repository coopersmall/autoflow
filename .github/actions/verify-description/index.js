import * as core from "@actions/core";

async function run() {
  const prBody = core.getInput("pr_body");

  const whatHeaderRegex = /^#+\s*What\s*$/m;
  if (!whatHeaderRegex.test(prBody)) {
    core.error(
      'Please add a "What" section to your PR description (# What, ## What, or ### What).',
      { title: 'Missing "What" Section' },
    );
    process.exit(1);
  }

  const testingHeaderRegex = /^#+\s*Testing\s*$/m;
  if (!testingHeaderRegex.test(prBody)) {
    core.error(
      'Please add a "Testing" section to your PR description (# Testing, ## Testing, or ### Testing).',
      { title: 'Missing "Testing" Section' },
    );
    process.exit(1);
  }

  core.info(
    "PR Description Format Verified - All required sections are present.",
  );
}

await run();
