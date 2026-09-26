export const APPOINTMENT_LIST_FIXTURE_POLICY = 'TEST_ONLY_SYNTHETIC_APPOINTMENT_LIST_VIEW_ITEMS'

const makeSnapshot = (visitId, visitStatus, institutionDisplay = {
  availability: 'ready',
  name: `Synthetic Historical Institution ${visitId}`,
}) => ({
  visitId,
  visitStatus,
  visitDate: '2020-01-02',
  visitTimePreference: 'morning',
  participantCount: 2,
  institutionDisplay,
})

export const makeAppointmentListFixtures = () => [
  makeSnapshot('visit-test-requested', 'requested'),
  makeSnapshot('visit-test-contacting', 'contacting'),
  makeSnapshot('visit-test-scheduled', 'scheduled'),
  makeSnapshot('visit-test-completed', 'completed', { availability: 'unavailable', name: null }),
  makeSnapshot('visit-test-cancelled', 'cancelled'),
]
