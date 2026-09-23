# Phase V1.2-C6 Handoff — Purpose-bound User.phone Authorization Evidence Integration

状态：`FROZEN_PHASE_V1_2_C6_DEFINITION / PHASE_V1_2_C6_NOT_STARTED`

冻结日期：`2026-09-23`

```text
PRE_SUCCESSOR_HEAD = 5131f45c8dc7d8d2b4a3c6fbfdbda10826071ca3
POST_C5_SUCCESSOR_DISCOVERY = PASS
AUTHORITATIVE_NEXT_PHASE = IDENTIFIED
NEXT_PHASE_ID = V1.2-C6
NEXT_PHASE_NAME = Purpose-bound User.phone Authorization Evidence Integration
NEXT_PHASE_TYPE = CONTACT_EVIDENCE_INTEGRATION
NEXT_PHASE_DEFINITION = PASS
NEXT_PHASE_IMPLEMENTATION_HANDOFF = FROZEN
PHASE_V1_2_C6 = NOT_STARTED
PRODUCT_DECISIONS = CLOSED
BLOCKERS_TO_START = 0
READY_TO_START_NEXT_PHASE = TRUE

PHASE_V1_2_C5 = PASS / UNCHANGED
C5_IMPLEMENTATION = COMPLETE / UNCHANGED
C5_VALIDATED_IMPLEMENTATION_SOURCE = 66b22eba6c7eba07518073a888e37693aa51a9e2
MANDATORY_GATES_V1_2_C5 = 15/15 PASS / UNCHANGED
```

This handoff freezes only the next phase's scope and completion boundary. It does not change the current V1.2 Product Source or the C1/C3 Frozen Contracts, and it does not implement C6.

## 1. Source and current implementation

- Current Product Source: `docs/product/README.md` routes to the two V1.2 PDFs. The Appointment flow requests User.phone only for an explicit Appointment or Consultant-contact purpose; a submitted request is not an Institution confirmation.
- Frozen semantics: `APPOINTMENT_INSTITUTION_VISIT_CONTRACT_V1.md` requires a trusted principal, authorized Elder, exact Institution revision, and purpose-authorized contact for formal persistence. User.phone is contact data, never account identity. `AUTHENTICATED_VISIT_SUBMISSION_PERSISTENCE_CONTRACT_V1.md` fixes contact evidence outcomes, no-Visit failure behavior, draft preservation, and the `appointment_or_consultant_contact` purpose. Provider, consent interaction, evidence encoding, and transport are implementation choices within those constraints.
- C4/C5: C4 has a versioned Backend submission endpoint and `PurposeBoundContactVerifier` port. C5 supplies the real authenticated principal and self-owned session. Production contact and reference adapters still select unavailable implementations, so auth success cannot create a Visit.
- Mini Program: the Appointment application service has ports and validation, while auth/session transport and create/success pages remain unconnected scaffolds.

## 2. Candidate review

| Candidate | Decision | Minimum dependency |
|---|---|---|
| Purpose-bound User.phone authorization/evidence provider | `READY` | C1/C3 purpose and outcome semantics and C5 principal are available; implement an explicit consent interaction and real Backend verifier with authorized external provider evidence. |
| Canonical Institution / Elder production reference adapters | `REQUIRES_PREREQUISITE` | A Backend-readable authoritative Institution revision source and persisted Elder ownership source must be identified and integrated; local catalog/profile cannot authorize. |
| Mini Program authenticated submission transport | `REQUIRES_PREREQUISITE` | C5 session exists, but production phone and reference evidence plus client session handling are needed for a truthful accepted submission. |
| Appointment create/success Page formal wiring | `DEFERRED` | Requires the authenticated transport and all Backend gates; only a committed `accepted`/`replayed` receipt permits success. |
| Authenticated owner-read | `DEFERRED` | Requires real persisted owner Visits and a separate permission-filtered query boundary. |
| Operations lifecycle mutation | `DEFERRED` | Requires persisted Visits, authorized actor commands, audit, and authoritative status transitions. |
| VisitEvaluation prerequisite slice | `DEFERRED` | Requires real server `visitId`, authorized owner, exact Institution, authoritative `completed`, and its future versioned Contract. |

## 3. Immediate successor decision

`V1.2-C6` is the unique immediate implementation phase. C5 closes the identity prerequisite and C4 already has the contact verifier port. Purpose-bound contact is the next independently testable production gate; it can fail closed while canonical references remain unavailable. Reference adapters cannot be completed from client catalog or local ElderProfile, and transport/Page cannot claim a persisted Visit before both contact and references pass.

```text
WHY_NOW = C5_TRUSTED_PRINCIPAL_COMPLETE_AND_C4_CONTACT_PORT_UNIMPLEMENTED
PREREQUISITES = C1_C3_FROZEN_SEMANTICS + C4_CONTACT_PORT + C5_SESSION / SATISFIED
DEFERRED_CANDIDATES = REFERENCE_ADAPTERS, TRANSPORT, PAGE, OWNER_READ, OPERATIONS, VISIT_EVALUATION
PRODUCT_DECISIONS = CLOSED
BLOCKERS_TO_START = 0
```

Owner-authorized WeChat phone capability and provider credentials are external prerequisites for **full production evidence**, not permission to substitute a test provider or invent business semantics. Their absence permits implementation work but forbids a full C6 PASS. If implementation exposes a genuine semantic gap in C1/C3, stop and request a versioned Contract decision before changing behavior.

## 4. C6 implementation boundary

1. Obtain phone authorization only after an explicit Appointment or Consultant-contact action. Decline, cancellation, missing evidence, expiry, invalidity, and provider unavailability preserve the local draft and create zero Visit.
2. Verify a real provider-issued phone proof at the Backend boundary. A client phone string, local draft, C5 login success, or `wx.login` code alone is not authorization evidence. The verifier must require the frozen `appointment_or_consultant_contact` purpose and match the authorized private contact value to the submitted contact value.
3. Keep User.phone separate from principal, ownership, session, idempotency, Recommendation, AI context, Institution official contact, and Consultant phone. No fallback or account linking is permitted.
4. Return only existing stable C3 outcomes and minimum client-safe data. Provider raw response, phone proof, private contact, secrets, and internal locators must not enter public results, routes, logs, analytics, fixtures, or source.
5. Select the real production verifier only with complete authorized configuration; otherwise use a fail-closed unavailable boundary. Test adapters remain test-only. C4 auth and reference checks must retain their order and behavior.
6. C6 does not implement canonical references, Mini Program authenticated submission transport, the Appointment form/success flow, Visit persistence, owner-read, Operations, or VisitEvaluation. It does not alter C5 authentication or C1/C3 semantics.

Private provider protocol, endpoint shape, proof format, storage, expiry, and rotation are implementation choices constrained by C1/C3 privacy and fail-closed rules. This handoff does not pre-approve a new public result code or a new product purpose.

## 5. Completion evidence

- Targeted Backend and Mini Program checks cover explicit authorization, decline/cancel, missing/expired/invalid proof, provider failure, purpose mismatch, contact-value mismatch, and no fallback.
- Production context selects the real verifier only with complete configuration; absent prerequisites fail closed. C4/C5 regression proves principal/session and reference gates remain intact and no Visit is created by phone acquisition.
- An Owner-authorized real phone-provider exchange and Backend verification are mandatory for full C6 PASS. Synthetic/test evidence may validate implementation but cannot satisfy the real-provider Gate. Never record raw phone, proof, provider response, or credentials in Git, logs, docs, or test snapshots.
- Independent targeted QA reconciles the implementation diff, privacy boundary, production/test isolation, and exact source identity. Full repository tests, Appointment Page QA, and Android device testing are not automatic C6 requirements.

```text
PHASE_V1_2_C6 = NOT_STARTED
REAL_PHONE_PROVIDER_EVIDENCE = MISSING
READY_FOR_C6_SUCCESSOR = FALSE
PRODUCTION_CODE_CHANGE = 0
RUNTIME_CODE_CHANGE = 0
TEST_CODE_CHANGE = 0
FROZEN_CONTRACT_CHANGE = 0
PRODUCT_SOURCE_CHANGE = 0
```

## 6. Mandatory Gate and status clarification

This section expands Section 5's four completion-evidence groups into checkable implementation Gates. It adds no phone purpose, result status, provider protocol, or public business behavior. All Gates are mandatory for full C6 PASS.

| Gate | Required evidence |
|---|---|
| G01 Contract conformance | C1/C3 purpose, contact outcome, draft, no-Visit, and privacy semantics remain unchanged. |
| G02 Explicit authorization | Phone acquisition follows an explicit Appointment or Consultant-contact action; decline/cancel/missing paths preserve draft. |
| G03 Purpose and contact validation | Backend validates `appointment_or_consultant_contact` and equality with the authorized private contact value. |
| G04 Phone is not identity | Phone never becomes principal, session, account-link, ownership, or idempotency authority. |
| G05 Authenticated boundary | C6 acquisition and consumption respect the C5 authenticated principal/session boundary without changing C5 semantics. |
| G06 Production provider | A real WeChat phone provider is selected only with complete authorized configuration; production has no test fallback. |
| G07 Evidence mapping | Provider success/failure maps only to the frozen C3 contact taxonomy; no new stable business result is introduced. |
| G08 Fail closed | Missing, declined, expired, invalid, repeated, mismatched, and unavailable evidence never authorizes contact or creates a Visit. |
| G09 Privacy and Secret firewall | Raw provider data, User.phone, proof, credential, and internal locator stay out of public result, route, log, analytics, fixture, and source. |
| G10 C4 integration and isolation | C4 consumes only verified purpose-bound evidence; reference remains unavailable and phone acquisition creates no Visit. |
| G11 Targeted regression and compatibility | Direct Backend tests, C4/C5 regression, and necessary Mini Program WeChat runtime checks pass. |
| G12 Independent targeted QA | Diff-driven QA checks Contract, phone/identity separation, provider/test isolation, privacy, source identity, and scope. |
| G13 Authorized real provider | Owner-authorized WeChat phone capability demonstrates consent, real provider exchange, Backend verification, required negative paths, and no Visit. |

```text
FULL_PASS = G01..G13 PASS
PHASE_V1_2_C6 = PASS                 # only after 13/13 PASS
C6_IMPLEMENTATION = COMPLETE        # only after 13/13 PASS
READY_FOR_C6_SUCCESSOR = TRUE       # only after 13/13 PASS

NONFINAL_PROVIDER_PENDING = G01..G12 PASS + G13 MISSING
PHASE_V1_2_C6 = PASS_WITH_RISKS      # only for this nonfinal condition
C6_IMPLEMENTATION = COMPLETE_PENDING_EXTERNAL_PROVIDER_EVIDENCE
REAL_PHONE_PROVIDER_EVIDENCE = MISSING
READY_FOR_C6_SUCCESSOR = FALSE
```
