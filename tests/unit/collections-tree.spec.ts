import { test, expect } from "@playwright/test";
import { getChildren, getTeamSpaces, getBreadcrumbPath, hasChildren, canNestInto, type TreeCollection } from "@/lib/collections-tree";

function c(id: string, name: string, parentId: string | null = null, isTeamSpace = false): TreeCollection {
  return { id, name, parent_id: parentId, is_team_space: isTeamSpace };
}

test.describe("getChildren", () => {
  test("returns top-level, non-team-space collections sorted alphabetically", () => {
    const all = [c("2", "Zebra"), c("1", "Apple"), c("3", "Team", null, true)];
    expect(getChildren(all, null).map((x) => x.id)).toEqual(["1", "2"]);
  });

  test("returns sub-folders of a given parent", () => {
    const all = [c("p", "Parent"), c("a", "A", "p"), c("b", "B", "other")];
    expect(getChildren(all, "p").map((x) => x.id)).toEqual(["a"]);
  });
});

test.describe("getTeamSpaces", () => {
  test("returns only team spaces, sorted alphabetically", () => {
    const all = [c("1", "Beta", null, true), c("2", "Alpha", null, true), c("3", "Personal")];
    expect(getTeamSpaces(all).map((x) => x.id)).toEqual(["2", "1"]);
  });
});

test.describe("getBreadcrumbPath", () => {
  test("returns [] for the root (null)", () => {
    expect(getBreadcrumbPath([c("1", "A")], null)).toEqual([]);
  });

  test("returns [folder] for a top-level folder", () => {
    const all = [c("1", "A")];
    expect(getBreadcrumbPath(all, "1").map((x) => x.id)).toEqual(["1"]);
  });

  test("returns [parent, child] for a sub-folder", () => {
    const all = [c("p", "Parent"), c("c", "Child", "p")];
    expect(getBreadcrumbPath(all, "c").map((x) => x.id)).toEqual(["p", "c"]);
  });
});

test.describe("hasChildren", () => {
  test("true when a collection has at least one child", () => {
    const all = [c("p", "Parent"), c("c", "Child", "p")];
    expect(hasChildren(all, "p")).toBe(true);
    expect(hasChildren(all, "c")).toBe(false);
  });
});

test.describe("canNestInto", () => {
  const parent = c("p", "Parent");
  const childless = c("x", "Childless");
  const withChild = c("y", "WithChild");
  const child = c("z", "Z", "y");
  const team = c("t", "Team", null, true);
  const all = [parent, childless, withChild, child, team];

  test("a childless top-level folder can nest into another top-level folder", () => {
    expect(canNestInto(all, childless, parent)).toBe(true);
  });

  test("a folder can't nest into itself", () => {
    expect(canNestInto(all, parent, parent)).toBe(false);
  });

  test("a folder with children can't be nested", () => {
    expect(canNestInto(all, withChild, parent)).toBe(false);
  });

  test("a folder can't nest into a sub-folder (target must be top-level)", () => {
    expect(canNestInto(all, childless, child)).toBe(false);
  });

  test("team spaces can never be dragged or targeted", () => {
    expect(canNestInto(all, team, parent)).toBe(false);
    expect(canNestInto(all, childless, team)).toBe(false);
  });

  test("nesting into the folder it's already inside of is a no-op, not offered", () => {
    const alreadyNested = c("w", "W", "p");
    expect(canNestInto([...all, alreadyNested], alreadyNested, parent)).toBe(false);
  });
});
