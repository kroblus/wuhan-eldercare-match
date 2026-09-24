export const APPOINTMENT_LIST_FIXTURE_POLICY = 'TEST_ONLY_SYNTHETIC_PUBLIC_VISIT_SNAPSHOTS'

const makeSnapshot = (visitId, status) => ({
  contractVersion: 'appointment-institution-visit-contract-v1',
  kind: 'institution_visit_public_snapshot_v1',
  visitId,
  elderId: `elder-${visitId}`,
  institutionId: `institution-${visitId}`,
  institutionRecordRevision: `revision-${visitId}`,
  visitDate: '2020-01-02',
  visitTimePreference: 'morning',
  participantCount: 2,
  status,
  acceptedAt: '2026-09-01T08:00:00.000Z',
})

export const makeAppointmentListFixtures = () => [
  makeSnapshot('visit-test-requested', 'requested'),
  makeSnapshot('visit-test-contacting', 'contacting'),
  makeSnapshot('visit-test-scheduled', 'scheduled'),
  makeSnapshot('visit-test-completed', 'completed'),
  makeSnapshot('visit-test-cancelled', 'cancelled'),
]
