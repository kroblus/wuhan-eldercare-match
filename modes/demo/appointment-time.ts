// Presentation only. recordedTime is an already formatted, explicitly recorded
// date/time, never an acceptance timestamp or a date inferred from status.
export const appointmentTimePresentation = (status: string, recordedTime = '') => ({
  timeLabel: status === 'completed' ? '看院时间' : '预约时间',
  time: recordedTime.trim() || (status === 'completed' || status === 'cancelled' ? '未记录' : '具体时间待确认'),
})
