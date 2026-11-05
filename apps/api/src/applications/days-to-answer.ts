import { daysBetween } from '../common/days.js';

export function daysToAnswer({
  appliedOn,
  answeredOn,
}: {
  appliedOn: Date;
  answeredOn: Date | null;
}): number | null {
  return answeredOn === null ? null : daysBetween(appliedOn, answeredOn);
}
