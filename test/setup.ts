import { afterAll } from "vitest";
import { stopPool } from "../src/testing/index.js";

afterAll(() => {
  stopPool();
});
