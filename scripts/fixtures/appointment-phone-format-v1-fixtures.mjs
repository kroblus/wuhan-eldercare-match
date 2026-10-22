// TEST_ONLY_SYNTHETIC: values are built in memory and must never be logged or sent to a real transport.
export const APPOINTMENT_PHONE_TEST_PROVENANCE = 'TEST_ONLY_SYNTHETIC'
export const syntheticMobile = () => '13' + '0'.repeat(9)
export const appointmentPhoneFormatCases = () => {
  const p = syntheticMobile()
  const internal = (c) => p.slice(0, 3) + c + p.slice(3)
  return [
    { id: 'V01', variant: 'canonical', input: p, valid: true },
    ...[3, 4, 5, 6, 7, 8, 9].map(d => ({ id: 'V01', variant: `second_${d}`, input: '1' + d + '0'.repeat(9), valid: true })),
    { id: 'V02', variant: 'repeated_edge_ASCII_spaces', input: '   ' + p + '  ', valid: true },
    { id: 'V03', variant: 'empty', input: '', valid: false },
    { id: 'V03', variant: 'only_spaces', input: '   ', valid: false },
    { id: 'V04', variant: 'ten_digits', input: p.slice(0, -1), valid: false },
    { id: 'V05', variant: 'twelve_digits', input: p + '0', valid: false },
    { id: 'V06', variant: 'six_digits', input: '0'.repeat(6), valid: false },
    { id: 'V07', variant: 'wrong_first', input: '2' + p.slice(1), valid: false },
    ...[0, 1, 2].map(d => ({ id: 'V08', variant: `wrong_second_${d}`, input: '1' + d + p.slice(2), valid: false })),
    { id: 'V09', variant: 'internal_space', input: internal(' '), valid: false },
    ...['\r', '\n', '\r\n'].map((c,i) => ({ id: 'V10', variant: `internal_line_${i}`, input: internal(c), valid: false })),
    { id: 'V10', variant: 'edge_LF', input: p + '\n', valid: false },
    { id: 'V11', variant: 'edge_TAB', input: '\t' + p + '\t', valid: false },
    ...['\u00a0','\u2003','\ufeff'].map((c,i) => ({ id: 'V12', variant: `unicode_edge_${i}`, input: c + p + c, valid: false })),
    { id: 'V12', variant: 'internal_NBSP', input: internal('\u00a0'), valid: false },
    { id: 'V13', variant: 'letter', input: p.slice(0,-1) + 'A', valid: false },
    ...['-','(',')','+','.'].map((c,i) => ({ id: 'V14', variant: `punctuation_${i}`, input: internal(c), valid: false })),
    { id: 'V15', variant: 'fullwidth', input: '１' + '３' + '０'.repeat(9), valid: false },
    { id: 'V16', variant: 'arabic_indic', input: '١' + '٣' + '٠'.repeat(9), valid: false },
    { id: 'V17', variant: 'manual_plus86', input: '+86' + p, valid: false },
    ...['\0','\u001f','\u007f','\t'].map((c,i) => ({ id: 'V18', variant: `control_${i}`, input: internal(c), valid: false })),
    { id: 'V18', variant: 'edge_CR', input: '\r' + p, valid: false },
    ...[null, undefined, 0, {}, []].map((input,i) => ({ id: 'V21', variant: `non_string_${i}`, input, valid: false })),
  ]
}
