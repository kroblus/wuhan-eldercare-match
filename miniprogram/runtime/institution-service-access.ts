// Existing development integrations keep their current behavior. PRODUCTION
// substitutes the explicit service policy from its read-only directory provider.
export const canRequestInstitutionService = (_institutionId: string): boolean => true
