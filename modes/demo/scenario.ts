// Explicit synthetic scenario. IDs are authored entities, never list positions.
export const demoScenario = {
  demoCaseId: 'demo-case-continuity-v1', provenance: 'TEST_ONLY', userId: 'demo-user-continuity',
  completedAt: '2026-10-20T03:00:00.000Z',
  elders: [
    { elderId: 'demo-elder-lin', name: '演示老人·林女士', assessmentId: 'demo-assessment-lin-v1' },
    { elderId: 'demo-elder-chen', name: '演示老人·陈女士', assessmentId: 'demo-assessment-chen-v1' },
  ],
  appointments: [
    { institutionId: 'demo-inst-chunhe-center', status: 'requested' },
    { institutionId: 'demo-inst-chunhe-home', status: 'completed' },
    { institutionId: 'demo-inst-chunhe-garden', status: 'completed' },
  ],
} as const
