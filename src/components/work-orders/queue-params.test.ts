import { describe, expect, it } from "vitest";
import {
  EMPTY_QUEUE_FILTER,
  isQueueFiltered,
  readQueueFilter,
  writeQueueParams,
} from "./queue-params";

const SITES = ["fac-KGN", "fac-SUD"];

function params(query: string): URLSearchParams {
  return new URLSearchParams(query);
}

describe("reading a queue filter out of an address", () => {
  it("reads every facet", () => {
    const filter = readQueueFilter(
      params(
        "status=open,assigned&priority=critical&type=corrective&facility=fac-KGN&assignee=crew&due=overdue&q=pump",
      ),
      SITES,
    );

    expect(filter.status).toEqual(["open", "assigned"]);
    expect(filter.priority).toEqual(["critical"]);
    expect(filter.type).toEqual(["corrective"]);
    expect(filter.facilityId).toBe("fac-KGN");
    expect(filter.assignee).toBe("crew");
    expect(filter.due).toBe("overdue");
    expect(filter.query).toBe("pump");
  });

  it("drops a value it does not recognise instead of matching nothing", () => {
    /*
     * The case this function exists for. Someone edits an address by hand, or a
     * link outlives a rename: "no work orders match" and "that word is not a
     * status" are different answers, and showing an empty queue would give the
     * wrong one.
     */
    const filter = readQueueFilter(
      params(
        "status=open,nonsense&priority=urgent&due=someday&facility=fac-XX",
      ),
      SITES,
    );

    expect(filter.status).toEqual(["open"]);
    expect(filter.priority).toEqual([]);
    expect(filter.due).toBe("any");
    expect(filter.facilityId).toBeUndefined();
  });

  it("reads an address with nothing in it as no opinion", () => {
    expect(readQueueFilter(params(""), SITES)).toEqual(EMPTY_QUEUE_FILTER);
    expect(isQueueFiltered(EMPTY_QUEUE_FILTER)).toBe(false);
  });

  it("survives the spacing a person types", () => {
    const filter = readQueueFilter(
      params("status= open , assigned ,,&q=  pump  "),
      SITES,
    );

    expect(filter.status).toEqual(["open", "assigned"]);
    expect(filter.query).toBe("pump");
  });
});

describe("writing a filter back into an address", () => {
  it("leaves out everything at its default", () => {
    // A queue nobody has narrowed has a clean address, so a parameter being
    // there means somebody chose it.
    expect(writeQueueParams(EMPTY_QUEUE_FILTER)).toEqual({});
  });

  it("round-trips a filter through the address unchanged", () => {
    const original = {
      ...EMPTY_QUEUE_FILTER,
      status: ["open", "waitingForParts"] as const,
      priority: ["critical"] as const,
      facilityId: "fac-SUD",
      assignee: "unassigned" as const,
      due: "week" as const,
      query: "pump",
    };

    const written = writeQueueParams(original);
    const read = readQueueFilter(
      params(new URLSearchParams(written).toString()),
      SITES,
    );

    expect(read).toEqual(original);
    // The control: a round trip through two functions that both did nothing
    // would also pass, so the address itself has to carry the values.
    expect(written.status).toBe("open,waitingForParts");
    expect(written.q).toBe("pump");
  });

  it("says whether anything has been narrowed", () => {
    expect(isQueueFiltered({ ...EMPTY_QUEUE_FILTER, query: "x" })).toBe(true);
    expect(isQueueFiltered({ ...EMPTY_QUEUE_FILTER, due: "overdue" })).toBe(
      true,
    );
    expect(isQueueFiltered({ ...EMPTY_QUEUE_FILTER, query: "   " })).toBe(
      false,
    );
  });
});
