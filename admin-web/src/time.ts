import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);
export const today = () => dayjs().utcOffset(8).format('YYYY-MM-DD');
export const time = (value?: string | null) =>
  value ? dayjs(value).utcOffset(8).format('YYYY-MM-DD HH:mm') : '尚未记录';
export const beijingInput = (value?: string | null) =>
  value ? dayjs(value).utcOffset(8).format('YYYY-MM-DDTHH:mm') : '';
export const toUtc = (value?: string) =>
  value ? new Date(value + ':00+08:00').toISOString() : null;
