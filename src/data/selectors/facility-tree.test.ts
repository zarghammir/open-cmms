import { describe, expect, it } from "vitest";
import { buildSeed, type DemoData } from "@/data/seed";
import { isOpenStatus } from "@/domain/constants/work-order-status";
import type { Id } from "@/domain/types";
import { equipmentIn, facilityTree, type FacilityNode } from "./facility-tree";

/**
 * Every number on the Facilities tree equals the register and the queue,
 * narrowed to that node.
 *
 * **Computed the other way round on purpose.** The selector walks down — a
 * node's subtree, then the assets filed in it. This test walks up — for each
 * asset, from its room through its floor and building to its site, asking
 * whether it passes through the node in question. Two directions over the same
 * records can disagree; the same direction twice cannot, and a test that
 * re-ran the selector's own arithmetic would agree with a broken selector
 * exactly as happily as with a working one.
 */

const TODAY = new Date("2026-09-12T00:00:00.000Z");

/** Every place from one location up to its site, as a person would read it. */
function ancestry(data: DemoData, locationId: Id): Set<Id> {
  const byId = new Map(data.locations.map((one) => [one.id, one]));
  const chain = new Set<Id>();
  let current = byId.get(locationId);
  while (current) {
    chain.add(current.id);
    chain.add(current.facilityId);
    current =
      current.parentId === null ? undefined : byId.get(current.parentId);
  }
  return chain;
}

function flatten(nodes: FacilityNode[]): FacilityNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

describe("the facilities tree", () => {
  const data = buildSeed(TODAY);
  const nodes = flatten(facilityTree(data));

  it("has a tree to check at all", () => {
    /*
     * The floor. Every assertion below walks a list of nodes, and an empty list
     * satisfies all of them — a selector that returned nothing would read as
     * perfect agreement with everything.
     */
    expect(nodes.length).toBeGreaterThanOrEqual(20);
    expect(nodes.some((node) => node.kind === "site")).toBe(true);
    expect(nodes.some((node) => node.kind === "room")).toBe(true);
  });

  it("counts the equipment the register would show under each node", () => {
    const wrong = nodes
      .map((node) => {
        const register = data.assets.filter((asset) =>
          ancestry(data, asset.locationId).has(node.id),
        ).length;
        return { node, register };
      })
      .filter(({ node, register }) => node.equipment !== register)
      .map(
        ({ node, register }) =>
          `${node.code} (${node.kind}): tree says ${node.equipment}, the register says ${register}`,
      );

    expect(wrong).toEqual([]);
  });

  it("counts the open work the queue would show under each node", () => {
    const wrong = nodes
      .map((node) => {
        const queue = data.workOrders.filter(
          (order) =>
            isOpenStatus(order.status) &&
            ancestry(data, order.locationId).has(node.id),
        ).length;
        return { node, queue };
      })
      .filter(({ node, queue }) => node.openWork !== queue)
      .map(
        ({ node, queue }) =>
          `${node.code} (${node.kind}): tree says ${node.openWork}, the queue says ${queue}`,
      );

    expect(wrong).toEqual([]);
  });

  it("counts closed work nowhere", () => {
    /*
     * The control beside the two above. A tree that counted *every* work order
     * would still agree with a queue filter that did the same, so the number
     * has to be shown to exclude something: the sites hold completed and
     * cancelled orders, and none of them is in these totals.
     */
    const closed = data.workOrders.filter(
      (order) => !isOpenStatus(order.status),
    );
    expect(closed.length).toBeGreaterThan(0);

    const sites = facilityTree(data);
    const openEverywhere = sites.reduce(
      (total, site) => total + site.openWork,
      0,
    );
    expect(openEverywhere).toBeLessThan(data.workOrders.length);
    expect(openEverywhere).toBe(data.workOrders.length - closed.length);
  });

  it("lists a room's equipment, and only that room's", () => {
    const room = nodes.find(
      (node) => node.kind === "room" && node.equipment > 0,
    );
    expect(room, "no room in the seed holds equipment").toBeDefined();

    const listed = equipmentIn(data, room!.id);
    expect(listed).toHaveLength(room!.equipment);
    expect(listed.every((asset) => asset.locationId === room!.id)).toBe(true);
  });
});
