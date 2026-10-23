# Institution Ordinary Directory Display Amendment V1

```text
DOC_STATUS = FROZEN
DOC_KIND = CONTRACT
NORMATIVE = TRUE
DISPLAY_POLICY_VERSION = institution-ordinary-directory-display-v1
ADDRESS_CONTRACT_APPROVAL = OWNER_EXPLICIT_REQUEST_V2_1_B1_2_3
INSTITUTION_DOMAIN_VERSION_CHANGED = NO
```

## Authorization and exact scope

Owner's V2.1-B1.2.3 request, “机构卡片直接显示地址”, authorizes this narrow amendment when the existing process permits explicit Owner instructions as approval. The current AGENTS.md requires an explicit successor/version and Owner decision for a real Contract change. Architecture README requires preserving Frozen semantics in place; it specifies no additional approval authority or separate ceremony. This versioned amendment records that explicit Owner decision and its limits. It does not claim approval for any other Institution change.

For **ordinary direct current directory cards only** (Home preview/search and direct Institution List), this policy succeeds the full-address prohibition in Institution V1.2.1 §22. The original Frozen files remain unchanged. The prohibition continues for Recommendation candidates and Recommendation-context List. Official phone, map, full introduction and other list disclosures remain governed by existing rules.

## Address disclosure

- Read the existing exact-identity Detail Application snapshot and its official-address ViewModel projection. Do not read raw records/Evidence in Page/ViewModel, concatenate address components, parse region, use legacy `basic.address`, infer from name, or fall back to another revision.
- Display only the existing policy-approved public official address whose projected state is `ready`: provided, current verified and valid for the same identity/revision/evaluation context. Show that projected address verbatim, with natural wrapping and no truncation.
- Unknown, unavailable, unverified, expired, invalid or failed projections produce no address row or positive address claim. Preserve the distinct states in Detail and preserve institution-specific important risks in List; expired/unverified warnings remain explicit when applicable.
- An address never establishes map availability, proximity or a capability. No user location, new permission, provider, data, evidence, schema or persistence is introduced.

## Compact presentation and existing reference prices

Ordinary cards show full name, existing region, legal nonduplicate T1 nature, eligible address, eligible reference monthly price, institution-specific risks, and one detail affordance. Omit generic phone/status rows and empty label/address/price containers. Phone conflict or unreliable official-contact warnings remain visible; Detail phone/map actions are unchanged.

Price disclosure uses the existing current-verified provided `referenceMonthlyPrice` projection, exact identity and allowed run mode. Preserve CNY/month, reference-total basis, exact amounts, range versus starting-price meaning, and necessary qualifiers. Hide any unsupported or ambiguous scope, additional-charge/qualification combination that cannot be faithfully expressed, or invalid/unknown/unverified/expired price; no placeholder or household-budget substitution. This introduces no price fact or new Domain meaning. Existing synthetic prices may appear only within the isolated Demo with explicit TEST ONLY identity; they never enter Production.

## Preserved boundaries and verification

Canonical institutionId/recordRevision, sourceContextRef, source identity, current/historical resolution, evidence validity and dates, availability versus verification, all Recommendation V2 behavior (including NO_EXACT_MATCH), Assessment, CareProcess and N1 navigation remain unchanged. A display-policy marker belongs only to the ordinary-card projection; it is not a Domain version or identity.

Required checks: exact identity/revision, readiness/expiry gates, no legacy/raw fallback, no inferred tags/prices, qualified price units, absent rows, complete risk text, no truncation, single navigation, unchanged recommendation context, and Production/Demo isolation. Runtime and device evidence is recorded separately in the B1.2.3 handoff; this approval does not claim Android acceptance or authorize publication.
