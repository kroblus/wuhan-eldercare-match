/** A reviewed build artifact, never page parameters, storage or a runtime feature flag. */
export interface RecommendationSaveBuildV1 {
  kind: 'recommendation_save_test_only_build_v1'
  independentAppId: string
  standardAppId: string
  backendOrigin: string
  approvalReference: string
  artifactReference: string
}

// No independent TEST AppID/package approval is available in the normal application.
// A future approved isolated build may replace this module in its own artifact only.
export const readRecommendationSaveBuildV1 = (): RecommendationSaveBuildV1 | null => null
