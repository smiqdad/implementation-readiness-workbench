import {readFile, writeFile} from "node:fs/promises";
import {evaluateProject} from "../src/engine.js";

const data = JSON.parse(await readFile(new URL("../data/project.json", import.meta.url), "utf8"));
const evaluation = evaluateProject(data);
const snapshot = {
  project_id: evaluation.project.id,
  launch_status: evaluation.launch_status,
  counts: evaluation.counts,
  resolved: evaluation.resolved,
  total: evaluation.total,
  items: evaluation.items.map(({id, label, status, reason, owner, next_action}) => ({
    id,
    label,
    status,
    reason,
    owner,
    next_action
  }))
};
await writeFile(
  new URL("../examples/status-snapshot.json", import.meta.url),
  `${JSON.stringify(snapshot, null, 2)}\n`,
  "utf8"
);
