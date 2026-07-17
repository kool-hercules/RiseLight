// Human, calm time language. A bedside light should read like a person telling
// you what's happening, not a stopwatch. So instead of a ticking "00:14:52" we
// say "in about 15 minutes" and round to whole minutes; the number only changes
// once a minute, which feels serene rather than frantic.

export const humanizeCountdown = (ms: number): string => {
  if (ms <= 0) {
    return 'any moment now'
  }

  const totalSeconds = Math.ceil(ms / 1000)
  if (totalSeconds < 60) {
    return 'in less than a minute'
  }

  const minutes = Math.ceil(totalSeconds / 60)
  return `in about ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
}

// One place that formats a clock time, so every surface (plan, details, status)
// reads identically.
export const formatClockTime = (date: Date): string =>
  date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
