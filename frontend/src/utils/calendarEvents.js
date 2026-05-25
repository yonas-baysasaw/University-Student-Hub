import { CALENDAR_INVALIDATE_EVENT } from '../constants/dashboardEvents.js';

/** Tell open Calendar tabs (and other listeners) to refetch the feed. */
export function notifyCalendarInvalidate() {
  window.dispatchEvent(new CustomEvent(CALENDAR_INVALIDATE_EVENT));
}
