# Institution Ordinary Directory Call Amendment V1

```text
DOC_STATUS = FROZEN
DOC_KIND = CONTRACT
NORMATIVE = TRUE
ACTION_POLICY_VERSION = institution-ordinary-directory-call-v1
OWNER_APPROVAL = EXPLICIT_REQUEST_V2_1_B1_2_4
INSTITUTION_DOMAIN_VERSION_CHANGED = NO
```

## Approval and limited successor

Owner's V2.1-B1.2.4 request explicitly asks for a direct official-call action in ordinary cards, subject to the existing governance process. Current AGENTS requires an explicit successor/version and Owner decision; Architecture README prohibits rewriting Frozen semantics in place and specifies no additional approval authority. This document records that Owner decision as the narrow versioned successor; it is not approval for broader phone/data changes.

For Home and direct current ordinary Institution directory cards only, this policy succeeds the official-phone/action prohibition in Institution V1.2.1 §22 and the single-detail-affordance layout in ordinary-directory-display-v1. Cards may add one explicit official-call action beside Detail. It does not authorize displaying raw phone numbers on cards, Recommendation-context List calls, historical/pinned calls, map changes or broader contact disclosure. Original Frozen documents remain unchanged. Address, price, risk and all other ordinary-directory-display-v1 rules continue.

## Authority, identity and eligibility

- Reuse the exact Detail Application snapshot and Detail VM officialContact phone callAction. No raw record, evidence inspection, legacy publicContact, contact-note parsing, name inference, Consultant fallback or Page-level number normalization.
- The snapshot must match the card's canonical institutionId and recordRevision, published direct/current context, null sourceContextRef, permitted run mode/provenance and evaluation time. Never resolve latest or another revision as a fallback.
- Production requires the existing `callAction.available=true` and corresponding `dialValue` for a current verified directory and current verified legal child. Unknown, unavailable, unverified, expired, invalid, conflicting/unreliable source and wrong revision cannot dial. Existence alone grants nothing. Select the first eligible phone in the existing canonical projected order; do not invent ordering or infer purpose.
- Store at most projected phone key/availability on ordinary card Page data. Resolve the exact phone action afresh on explicit tap at current evaluation time; match the selected key, identity, revision and context. Do not reuse an expired captured dial value or substitute another institution/phone. If the selected item is no longer current/visible, page hides/unloads, or query/load generation changes while awaiting, do not call.
- Only the isolated Demo may offer a clearly labelled simulation; it must never invoke makePhoneCall, even if a test projection has a number. No new real dial mechanism is approved for Demo.

## Interaction matrix

| Action/state | Event and validation | Effect/navigation | Pending, failure and recovery |
|---|---|---|---|
| Eligible ordinary Production phone | native catchtap, fresh exact projected phone action | at most one wx.makePhoneCall; zero Detail navigation | one page-level pending action across cards, acquired before async work |
| No legal phone/conflict/expired/wrong revision | catchtap swallows parent; disabled/weak unavailable state | zero phone API and zero navigation | preserve existing specific risks and state distinctions; changed eligibility gives visible feedback |
| Demo simulation | explicit TEST ONLY simulation action | visible simulated feedback; zero real phone API/navigation | guarded, recoverable; no real contact promise |
| Cancel/API fail/synchronous throw | existing wx success/fail/complete semantics | no navigation or automatic retry | release once, actionable visible feedback, next intentional tap can retry |
| Detail/whole-card tap | existing canonical route and rapid navigation guard | existing single navigation | retained return/query/source behavior |
| Hide/unload/query/load change | invalidate pending async preflight | no late phone API | no stale callbacks changing another page/card; completed/cancelled action cannot permanently lock page |

One physical phone tap has one catchtap handler and at most one phone API invocation. No dual bindtap/triggerEvent chain or bubbling to the parent. The new call state must not reset the existing navigation guard or alter Assessment flow. Native unavailable controls must still swallow tap rather than passing it to the card.

## Verification and unaffected semantics

Test canonical current eligibility, same phone key, multiple-card number correspondence, old revision and wrong source/mode, expiry, generic unknown versus specific risk, double taps before preflight/API completion, cancellation, failure/throw, query/hide invalidation, parent event isolation, Detail/Back, Demo zero external calls, Recommendation-context skip and environment separation. Check current project wx typings, TS/generated JS and native event behavior; Android phone sheet evidence remains separate.

No Institution schema, official-phone evidence/date/purpose/extension semantics, record revision, data/provider, identity, source registry, permissions, matching/NO_EXACT_MATCH, Assessment, Consultant, appointment, map, VR or N1 navigation changes. This amendment does not authorize external calls during unattended validation: use a test-only wx mock to count API requests without actual dialing, and leave real Android phone-sheet acceptance to Owner.
