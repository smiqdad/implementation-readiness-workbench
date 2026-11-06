const VALID_DECISIONS = new Set(["approved_exception", "changes_requested"]);

export function normalizeValue(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export function latestApproval(approvals, requirementId) {
  return [...approvals]
    .filter((approval) => approval.requirement_id === requirementId)
    .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))[0] ?? null;
}

export function evaluateRequirement(requirement, approvals = []) {
  const desired = normalizeValue(requirement.desired_value);
  const live = normalizeValue(requirement.live_value);
  const evidencePresent = !requirement.evidence_required || requirement.evidence_ids.length > 0;
  const approval = latestApproval(approvals, requirement.id);

  if (!desired && requirement.required) {
    return result(requirement, "blocked", "Required desired state is missing.", evidencePresent, approval);
  }
  if (!live && requirement.required) {
    return result(requirement, "blocked", "Required live configuration is missing.", evidencePresent, approval);
  }
  if (!evidencePresent) {
    return result(requirement, "blocked", "Required evidence is missing.", evidencePresent, approval);
  }
  if (approval?.decision === "changes_requested") {
    return result(requirement, "blocked", "A reviewer requested changes.", evidencePresent, approval);
  }
  if (desired === live) {
    return result(requirement, "ready", "Desired and live states match with required evidence.", evidencePresent, approval);
  }

  if (requirement.validation?.type === "reviewable_difference") {
    if (approval?.decision === "approved_exception") {
      return result(requirement, "approved_exception", "A reviewer accepted the documented difference.", evidencePresent, approval);
    }
    return result(requirement, "needs_review", "The difference requires accountable human judgment.", evidencePresent, approval);
  }

  return result(requirement, "blocked", "Live state conflicts with the required desired state.", evidencePresent, approval);
}

function result(requirement, status, reason, evidencePresent, approval) {
  return {
    ...requirement,
    status,
    reason,
    evidence_present: evidencePresent,
    latest_approval: approval
  };
}

export function evaluateProject(data) {
  const items = data.requirements.map((requirement) => evaluateRequirement(requirement, data.approvals));
  const counts = items.reduce(
    (summary, item) => {
      summary[item.status] += 1;
      return summary;
    },
    {ready: 0, blocked: 0, needs_review: 0, approved_exception: 0}
  );
  const resolved = counts.ready + counts.approved_exception;
  const launchStatus = counts.blocked > 0
    ? "blocked"
    : counts.needs_review > 0
      ? "approval_required"
      : "ready_for_launch";

  return {
    project: data.project,
    launch_status: launchStatus,
    counts,
    resolved,
    total: items.length,
    items
  };
}

export function applyDecision(data, {requirementId, decision, actor, rationale, timestamp}) {
  if (!VALID_DECISIONS.has(decision)) {
    throw new Error(`Unsupported decision: ${decision}`);
  }
  const requirement = data.requirements.find((item) => item.id === requirementId);
  if (!requirement) {
    throw new Error(`Unknown requirement: ${requirementId}`);
  }
  const current = evaluateRequirement(requirement, data.approvals);
  if (current.status !== "needs_review") {
    throw new Error(`Requirement ${requirementId} is not awaiting review`);
  }
  if (!normalizeValue(actor) || !normalizeValue(rationale)) {
    throw new Error("Reviewer and rationale are required");
  }

  const approval = {
    requirement_id: requirementId,
    decision,
    reviewer: normalizeValue(actor),
    rationale: normalizeValue(rationale),
    timestamp
  };
  const auditEvent = {
    timestamp,
    actor: approval.reviewer,
    action: decision,
    object_id: requirementId,
    detail: approval.rationale
  };

  return {
    ...data,
    approvals: [...data.approvals, approval],
    audit_log: [...data.audit_log, auditEvent]
  };
}
