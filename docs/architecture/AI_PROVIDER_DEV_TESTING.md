# AI Provider Development Testing

> DOCUMENT_ROLE = DEVELOPMENT_TOOLING_GUIDANCE
> BUSINESS_SOURCE_OF_TRUTH = FALSE
> FROZEN_CONTRACT = FALSE

## Purpose

This document defines local development rules for explicitly authorized live AI-provider testing.

Current development provider:

```text
PROVIDER = DEEPSEEK
AUTH = ENVIRONMENT_VARIABLE
ENV_VAR = DEEPSEEK_API_KEY
```

## Credential Policy

```text
DEEPSEEK_SECRET_IN_REPOSITORY = FALSE
DEEPSEEK_SECRET_IN_MINIPROGRAM = FALSE
DEEPSEEK_SECRET_IN_LOGS = FALSE
DEEPSEEK_SECRET_IN_PROMPTS = FALSE
DEEPSEEK_SECRET_IN_TEST_OUTPUT = FALSE
```

The real value of `DEEPSEEK_API_KEY` must exist only in the local user environment.

Do not commit, print, echo, log, screenshot, serialize, or persist the credential.

The repository may contain only the environment-variable name and non-secret placeholders.

## Allowed Use

The credential may be used only when the current task explicitly authorizes a live-provider test, for example:

- local Codex development verification;
- targeted live-provider smoke tests;
- future backend/provider-adapter development;
- explicitly authorized provider evaluations.

Deterministic and mock tests must remain independent from live-provider tests.

If `DEEPSEEK_API_KEY` is unavailable:

```text
LIVE_PROVIDER_GATE = NOT_RUN
REASON = CREDENTIAL_UNAVAILABLE
```

Do not fake a PASS. Tests that do not require the credential should continue normally.

## Architecture Boundary

The existence of a local development credential does not authorize direct Mini Program → DeepSeek calls.

The production direction remains:

```text
Mini Program
    ↓
self-owned Backend
    ↓
AI Provider
```

Provider keys, AppSecret values, bearer tokens, and equivalent secrets must never enter:

- Mini Program source or bundle;
- committed Git history;
- public-safe Application results;
- product documentation;
- Frozen Contracts;
- prompts or audit output.

## Evidence Rules

Live-provider evidence and deterministic/mock evidence must be reported separately.

A successful local live-provider call proves only that the authorized development credential and provider path worked for that test. It does not prove that the production backend, persistence, deployment, or security architecture is complete.

## Provider Neutrality

This development guidance does not freeze DeepSeek as the permanent production provider.

Provider selection, backend ownership, API protocol, persistence, retry policy, and production deployment remain subject to the relevant future phase Handoff / CURRENT architecture documents.

## Local Environment Example

Windows user environment:

```text
DEEPSEEK_API_KEY=<set locally; never commit>
```

Optional non-secret configuration may be introduced later only when formally needed.

## Git Hygiene

Recommended ignored local-secret patterns:

```gitignore
.env
.env.*
!.env.example
.secrets/
*.secret
```

Before committing provider-related work, verify that no secret is present in:

- staged diff;
- tracked configuration;
- test snapshots;
- logs;
- screenshots;
- generated artifacts.
