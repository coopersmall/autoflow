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
    core.error(
      `Please add one of the required labels: ${requiredLabels.join(", ")}`,
      { title: "No Labels Found" },
    );
    process.exit(1);
  }

  const matchingLabels = requiredLabels.filter((required) =>
    parsed.includes(required.toLowerCase()),
  );

  if (matchingLabels.length === 0) {
    core.error(
      `PR must have one of these labels: ${requiredLabels.join(", ")}`,
      { title: "Missing Required Label" },
    );
    process.exit(1);
  }

  if (matchingLabels.length > 1) {
    core.error(
      `PR cannot have multiple labels from: ${requiredLabels.join(", ")}. Current: ${matchingLabels.join(", ")}`,
      { title: "Multiple Conflicting Labels" },
    );
    process.exit(1);
  }

  core.info(`Labels Verified - PR has the correct label: ${matchingLabels[0]}`);
}

await run();
