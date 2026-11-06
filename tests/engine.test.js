import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {applyDecision, evaluateProject, evaluateRequirement, normalizeValue} from "../src/engine.js";

const data = JSON.parse(await readFile(new URL("../data/project.json", import.meta.url), "utf8"));

test("normalizes whitespace without changing meaning", () => {
  assert.equal(normalizeValue("  Manager   then\nFinance "), "Manager then Finance");
});

test("matching configured value with evidence is ready", () => {
  const requirement = data.requirements.find((item) => item.id === "REQ-001");
  assert.equal(evaluateRequirement(requirement).status, "ready");
});

test("missing live value blocks a required requirement", () => {
  const requirement = data.requirements.find((item) => item.id === "REQ-002");
  const result = evaluateRequirement(requirement);
  assert.equal(result.status, "blocked");
  assert.match(result.reason, /live configuration is missing/i);
});

test("missing evidence blocks an apparent match", () => {
  const requirement = data.requirements.find((item) => item.id === "REQ-007");
  const result = evaluateRequirement(requirement);
  assert.equal(result.status, "blocked");
  assert.match(result.reason, /evidence is missing/i);
});

test("reviewable difference requires accountable review", () => {
  const requirement = data.requirements.find((item) => item.id === "REQ-004");
  assert.equal(evaluateRequirement(requirement).status, "needs_review");
});

test("approved exception resolves a review item and records audit history", () => {
  const updated = applyDecision(data, {
    requirementId: "REQ-004",
    decision: "approved_exception",
    actor: "Avery Chen",
    rationale: "Accepted for launch with a documented follow-up control.",
    timestamp: "2026-11-06T10:00:00Z"
  });
  const requirement = data.requirements.find((item) => item.id === "REQ-004");
  assert.equal(evaluateRequirement(requirement, updated.approvals).status, "approved_exception");
  assert.equal(updated.audit_log.at(-1).object_id, "REQ-004");
});

test("requested changes turn a review item into a blocker", () => {
  const updated = applyDecision(data, {
    requirementId: "REQ-009",
    decision: "changes_requested",
    actor: "Avery Chen",
    rationale: "Daily reporting remains required for launch.",
    timestamp: "2026-11-06T10:05:00Z"
  });
  const requirement = data.requirements.find((item) => item.id === "REQ-009");
  assert.equal(evaluateRequirement(requirement, updated.approvals).status, "blocked");
});

test("rejects decisions for requirements that are not awaiting review", () => {
  assert.throws(() => applyDecision(data, {
    requirementId: "REQ-001",
    decision: "approved_exception",
    actor: "Avery Chen",
    rationale: "Not applicable.",
    timestamp: "2026-11-06T10:10:00Z"
  }), /not awaiting review/);
});

test("project remains blocked while required blockers exist", () => {
  const result = evaluateProject(data);
  assert.equal(result.launch_status, "blocked");
  assert.deepEqual(result.counts, {ready: 4, blocked: 3, needs_review: 2, approved_exception: 0});
});
