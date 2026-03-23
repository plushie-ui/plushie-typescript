import { describe, expect, test } from "vitest";
import { Route } from "../src/index.js";

describe("Route", () => {
  test("createRoute initializes with a single entry", () => {
    const route = Route.createRoute("/home");
    expect(Route.currentPath(route)).toBe("/home");
    expect(Route.currentParams(route)).toEqual({});
    expect(Route.canGoBack(route)).toBe(false);
  });

  test("createRoute with params", () => {
    const route = Route.createRoute("/settings", { tab: "general" });
    expect(Route.currentParams(route)).toEqual({ tab: "general" });
  });

  test("push adds a new entry on top", () => {
    let route = Route.createRoute("/home");
    route = Route.push(route, "/settings", { tab: "audio" });
    expect(Route.currentPath(route)).toBe("/settings");
    expect(Route.currentParams(route)).toEqual({ tab: "audio" });
    expect(Route.canGoBack(route)).toBe(true);
  });

  test("pop removes the top entry", () => {
    let route = Route.createRoute("/home");
    route = Route.push(route, "/settings");
    route = Route.pop(route);
    expect(Route.currentPath(route)).toBe("/home");
    expect(Route.canGoBack(route)).toBe(false);
  });

  test("pop on single entry is a no-op", () => {
    const route = Route.createRoute("/home");
    const same = Route.pop(route);
    expect(same).toBe(route);
  });

  test("routeHistory returns paths most recent first", () => {
    let route = Route.createRoute("/home");
    route = Route.push(route, "/settings");
    route = Route.push(route, "/about");
    expect(Route.routeHistory(route)).toEqual(["/about", "/settings", "/home"]);
  });
});
