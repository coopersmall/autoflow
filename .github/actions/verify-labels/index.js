import * as core from "@actions/core";

async function run() {
  const labels = core.getInput("labels");
  const parsed = labels
    ? JSON.parse(labels).map((label) => label.toLowerCase())
    : [];
  const requiredLabels = core
    .getInput("required_labels")
    .split(",")
    .map((label) => label.toLowerCase());

  if (!parsed || parsed.length === 0) {
    core.setFailed(
      `No Labels Found - Please add one of the required labels: ${requiredLabels.join(", ")}`,
    );
    return;
  }

  const matchingLabels = requiredLabels.filter((required) =>
    parsed.includes(required.toLowerCase()),
  );

  if (matchingLabels.length === 0) {
    core.setFailed(
      `Missing Required Label - PR must have one of these labels: ${requiredLabels.join(", ")}`,
    );
    return;
  }

  if (matchingLabels.length > 1) {
    core.setFailed(
      `Multiple Conflicting Labels - PR cannot have multiple labels from: ${requiredLabels.join(", ")}. Current: ${matchingLabels.join(", ")}`,
    );
    return;
  }

  core.info(`Labels Verified - PR has the correct label: ${matchingLabels[0]}`);
}

await run();
