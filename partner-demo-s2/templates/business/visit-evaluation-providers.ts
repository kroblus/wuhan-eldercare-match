import type {
  TestOnlyEvaluationContextProviderV1,
  TestOnlyEvaluationSubmitProviderV1,
} from '../pages/visit/visit-evaluation-application'
import type { DemoBusinessSessionV1 } from './business-session'
import {
  loadDemoEvaluationContext,
  PARTNER_DEMO_EVALUATION_PROVENANCE,
  submitDemoEvaluation,
} from './business-session'

export interface DemoVisitEvaluationProvidersV1 {
  provenance: 'TEST_ONLY'
  contextProvider: TestOnlyEvaluationContextProviderV1
  submitProvider: TestOnlyEvaluationSubmitProviderV1
}

export interface DemoVisitEvaluationOptionsV1 {
  session?: DemoBusinessSessionV1
}

export const createDemoVisitEvaluationProvidersV1 = (
  options: DemoVisitEvaluationOptionsV1 = {},
): DemoVisitEvaluationProvidersV1 => ({
  provenance: PARTNER_DEMO_EVALUATION_PROVENANCE,
  contextProvider: {
    loadContext(visitId: string) {
      return options.session ? options.session.loadEvaluationContext(visitId) : loadDemoEvaluationContext(visitId)
    },
  },
  submitProvider: {
    submit(input) {
      return options.session ? options.session.submitEvaluation(input) : submitDemoEvaluation(input)
    },
  },
})

const defaultDemoProviders = createDemoVisitEvaluationProvidersV1()

export const demoEvaluationContextProvider = defaultDemoProviders.contextProvider
export const demoEvaluationSubmitProvider = defaultDemoProviders.submitProvider
