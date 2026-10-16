// How long the parent controls stay up untouched before handing the screen
// back to the kid scene. First run pins them so a new parent can read the
// hint, but a phone set down on the nightstand mid-setup must not keep bright
// white text over the night light until morning, so even the pin lets go after
// a couple of quiet minutes (which also completes first run).
export const PARENT_IDLE_MS = 15_000
export const FIRST_RUN_IDLE_MS = 120_000

export const parentIdleMs = (pinned: boolean): number =>
  pinned ? FIRST_RUN_IDLE_MS : PARENT_IDLE_MS
