# Design Decisions

## Counts instead of a readiness score

The workbench reports ready, blocked, and review-item counts. It does not average a critical blocker into a reassuring percentage. The progress bar is a count visualization, while launch status follows explicit gating rules.

## Desired state and live state remain separate

The interface never overwrites the requirement with the configured value. That separation makes discrepancies inspectable and prevents the current implementation from silently becoming the approved requirement.

## Deterministic rules own known validation

Exact matches, missing configuration, missing evidence, and approval-state transitions are deterministic. A future AI component could help extract or map requirements, but it would not silently approve consequential configuration.

## Approval is an attributable state transition

Reviewable differences can become approved exceptions only through a named reviewer and recorded rationale. Requested changes create a blocker. Both actions append an audit event.

## Synthetic scenario with fresh implementation

The companies, people, requirements, evidence, identifiers, and dates are fictional. The project was built from a blank repository and does not copy an employer or hiring-case system.

## No backend in the portfolio release

The browser demonstration operates in memory and resets on reload. This keeps the project inspectable and credential-free. A production version would require authorization, durable storage, concurrency controls, immutable audit records, and integration ownership.
