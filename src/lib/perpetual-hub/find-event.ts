import type { PerpetualHubOperation } from "./types";

type EventPage = { events: PerpetualHubOperation[]; total: number };

export async function findEvent({
  id,
  seq,
  fetchPage,
}: {
  id: number;
  seq?: number;
  fetchPage: (offset: number) => Promise<EventPage>;
}) {
  const pageSize = 100;
  const match = (page: EventPage) =>
    page.events.find(
      (event) =>
        event.id === id && (seq === undefined || event.teeSequence === seq),
    );
  // Most drill-downs come from recent activity. Resolve that page before
  // requesting older history, which must not block an already available event.
  const first = await fetchPage(0);
  const recent = match(first);
  if (recent) return recent;
  if (first.events.length < pageSize) return undefined;

  const total = first.total || Infinity;
  for (let offset = pageSize; offset < total; offset += pageSize * 4) {
    const offsets = Array.from(
      { length: 4 },
      (_, index) => offset + index * pageSize,
    ).filter((value) => value < total);
    const pages = await Promise.allSettled(offsets.map(fetchPage));
    for (const result of pages) {
      if (result.status === "fulfilled") {
        const found = match(result.value);
        if (found) return found;
      }
    }
    const failure = pages.find((result) => result.status === "rejected");
    if (failure?.status === "rejected") throw failure.reason;
    if (
      pages.some(
        (result) =>
          result.status === "fulfilled" &&
          result.value.events.length < pageSize,
      )
    )
      return undefined;
  }
  return undefined;
}
