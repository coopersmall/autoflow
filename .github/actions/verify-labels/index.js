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
    await core.summary
      .addHeading("No Labels Found", 2)
      .addRaw(
        `Please add one of the required labels: ${requiredLabels.join(", ")}`,
      )
      .write();
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
    await core.summary
      .addHeading("Missing Required Label", 2)
      .addRaw(`PR must have one of these labels: ${requiredLabels.join(", ")}`)
      .write();
    core.error(
      `PR must have one of these labels: ${requiredLabels.join(", ")}`,
      { title: "Missing Required Label" },
    );
    process.exit(1);
  }

  if (matchingLabels.length > 1) {
    await core.summary
      .addHeading("Multiple Conflicting Labels", 2)
      .addRaw(
        `PR cannot have multiple labels from: ${requiredLabels.join(", ")}. Current: ${matchingLabels.join(", ")}`,
      )
      .write();
    core.error(
      `PR cannot have multiple labels from: ${requiredLabels.join(", ")}. Current: ${matchingLabels.join(", ")}`,
      { title: "Multiple Conflicting Labels" },
    );
    process.exit(1);
  }

  await core.summary
    .addHeading("Labels Verified", 2)
    .addRaw(`PR has the correct label: ${matchingLabels[0]}`)
    .write();
  core.info(`Labels Verified - PR has the correct label: ${matchingLabels[0]}`);
}

await run();
