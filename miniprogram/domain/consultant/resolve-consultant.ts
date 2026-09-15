import type {
  ConsultantAssignmentInspectionV1,
  ConsultantDefaultConfigurationV1,
  InstitutionConsultantAssignmentV1,
} from '../../types/consultant-v1'

export type ConsultantAssignmentResolutionStatusV1 =
  | 'missing'
  | 'unknown'
  | 'inactive'
  | 'ambiguous'
  | 'selected'

export interface ConsultantAssignmentResolutionV1 {
  status: ConsultantAssignmentResolutionStatusV1
  assignmentSource: 'institution_assignment' | 'default_consultant' | null
  assignment: InstitutionConsultantAssignmentV1 | null
  consultantId: string | null
}

/**
 * Resolve only the frozen B1 relationship semantics. Default configuration is
 * inspected after, and only after, the institution-specific lookup is proven
 * to be missing.
 */
export const resolveConsultantAssignmentV1 = (
  lookup: ConsultantAssignmentInspectionV1,
  defaultConfiguration: ConsultantDefaultConfigurationV1,
): ConsultantAssignmentResolutionV1 => {
  if (lookup.status === 'active' && lookup.assignment) {
    return {
      status: 'selected',
      assignmentSource: 'institution_assignment',
      assignment: lookup.assignment,
      consultantId: lookup.assignment.consultantId,
    }
  }
  if (lookup.status === 'inactive') {
    return {
      status: 'inactive',
      assignmentSource: 'institution_assignment',
      assignment: lookup.assignment,
      consultantId: null,
    }
  }
  if (lookup.status === 'unknown') {
    return {
      status: 'unknown',
      assignmentSource: 'institution_assignment',
      assignment: null,
      consultantId: null,
    }
  }
  if (lookup.status === 'ambiguous') {
    return {
      status: 'ambiguous',
      assignmentSource: 'institution_assignment',
      assignment: null,
      consultantId: null,
    }
  }
  if (defaultConfiguration.enabled) {
    return {
      status: 'selected',
      assignmentSource: 'default_consultant',
      assignment: null,
      consultantId: defaultConfiguration.consultantId,
    }
  }
  return {
    status: 'missing',
    assignmentSource: null,
    assignment: null,
    consultantId: null,
  }
}
