// When the "okay to get up" alarm should fire: the wake-time anchor plus the
// wake-up window. Returns null when there's no active schedule or the moment has
// already passed (nothing to schedule). Pure so it can be unit-tested without
// the native notifications plugin.
export const computeAlarmTime = (
  nextWakeTime: Date | null,
  wakeDurationMinutes: number,
  nowMs: number
): Date | null => {
  if (!nextWakeTime) {
    return null
  }

  const at = nextWakeTime.getTime() + wakeDurationMinutes * 60_000
  if (!Number.isFinite(at) || at <= nowMs) {
    return null
  }

  return new Date(at)
}
