/**
 * Integration smoke test.
 *
 * Spawns the plushie binary in mock mode and exercises the basic
 * wire protocol handshake: settings -> hello -> snapshot -> interact.
 *
 * Skipped when no binary is available.
 */

import { describe, expect, test } from "vitest";
import type { DecodedResponse, WireMessage, WirePatchOp } from "../../src/client/protocol.js";
import {
  decodeMessage,
  encodeInteract,
  encodePatch,
  encodeQuery,
  encodeSettings,
  encodeSnapshot,
  encodeSubscribe,
  encodeTreeHash,
  encodeUnsubscribe,
  PROTOCOL_VERSION,
} from "../../src/client/protocol.js";
import { SpawnTransport } from "../../src/client/transport.js";
import { binaryAvailable, binaryPath } from "./setup.js";

function waitForMessage(
  transport: { onMessage(handler: (msg: Record<string, unknown>) => void): void },
  predicate: (decoded: DecodedResponse) => boolean,
  timeoutMs = 5000,
): Promise<DecodedResponse> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timed out waiting for message")), timeoutMs);
    transport.onMessage((raw) => {
      const decoded = decodeMessage(raw);
      if (decoded && predicate(decoded)) {
        clearTimeout(timer);
        resolve(decoded);
      }
    });
  });
}

describe.skipIf(!binaryAvailable)("integration: binary smoke test", () => {
  test("msgpack: settings -> hello -> snapshot -> interact round trip", async () => {
    const transport = new SpawnTransport({
      binary: binaryPath!,
      format: "msgpack",
      args: ["--mock"],
    });

    try {
      const helloPromise = waitForMessage(transport, (d) => d.type === "hello");
      transport.send(encodeSettings("", {}) as Record<string, unknown>);
      const hello = await helloPromise;

      expect(hello.type).toBe("hello");
      if (hello.type === "hello") {
        expect(hello.data.protocol).toBe(PROTOCOL_VERSION);
        expect(hello.data.mode).toBe("mock");
        expect(hello.data.name).toBe("plushie-renderer");
      }

      // Send a tree with a button
      const tree: WireMessage = {
        id: "main",
        type: "window",
        props: { title: "Test" },
        children: [{ id: "btn", type: "button", props: { label: "Click me" }, children: [] }],
      };
      transport.send(encodeSnapshot("", tree) as Record<string, unknown>);

      // Click the button
      const interactPromise = waitForMessage(transport, (d) => d.type === "interact_response");
      transport.send(
        encodeInteract(
          "",
          "click-1",
          "click",
          { by: "id", value: "btn", window_id: "main" },
          {},
        ) as Record<string, unknown>,
      );
      const response = await interactPromise;

      expect(response.type).toBe("interact_response");
      if (response.type === "interact_response") {
        expect(response.id).toBe("click-1");
        // Mock mode: click events are synthetic
        const events = response.events as WireMessage[];
        const clickEvent = events.find((e) => e["family"] === "click");
        expect(clickEvent).toBeDefined();
        expect(clickEvent?.["id"]).toBe("btn");
      }
    } finally {
      transport.close();
    }
  });

  test("json: settings -> hello -> query round trip", async () => {
    const transport = new SpawnTransport({
      binary: binaryPath!,
      format: "json",
      args: ["--mock"],
    });

    try {
      const helloPromise = waitForMessage(transport, (d) => d.type === "hello");
      transport.send(encodeSettings("", {}) as Record<string, unknown>);
      const hello = await helloPromise;
      expect(hello.type).toBe("hello");

      // Send snapshot
      transport.send(
        encodeSnapshot("", {
          id: "root",
          type: "column",
          props: { spacing: 8 },
          children: [
            { id: "greeting", type: "text", props: { content: "Hello World" }, children: [] },
          ],
        }) as Record<string, unknown>,
      );

      // Query for the text widget
      const queryPromise = waitForMessage(transport, (d) => d.type === "query_response");
      transport.send({
        type: "query",
        session: "",
        id: "q1",
        target: "find",
        selector: { by: "id", value: "greeting" },
      });
      const qResponse = await queryPromise;

      expect(qResponse.type).toBe("query_response");
      if (qResponse.type === "query_response") {
        expect(qResponse.data).not.toBeNull();
        const node = qResponse.data as Record<string, unknown>;
        expect(node["id"]).toBe("greeting");
        expect(node["type"]).toBe("text");
        const props = node["props"] as Record<string, unknown>;
        expect(props["content"]).toBe("Hello World");
      }
    } finally {
      transport.close();
    }
  });

  test("text_input interact produces input events", async () => {
    const transport = new SpawnTransport({
      binary: binaryPath!,
      format: "json",
      args: ["--mock"],
    });

    try {
      const helloPromise = waitForMessage(transport, (d) => d.type === "hello");
      transport.send(encodeSettings("", {}) as Record<string, unknown>);
      await helloPromise;

      transport.send(
        encodeSnapshot("", {
          id: "main",
          type: "window",
          props: { title: "Test" },
          children: [
            {
              id: "input",
              type: "text_input",
              props: { value: "", on_submit: true },
              children: [],
            },
          ],
        }) as Record<string, unknown>,
      );

      // Type text
      const typePromise = waitForMessage(transport, (d) => d.type === "interact_response");
      transport.send(
        encodeInteract(
          "",
          "i1",
          "type_text",
          { by: "id", value: "input", window_id: "main" },
          { text: "hi" },
        ) as Record<string, unknown>,
      );
      const response = await typePromise;

      if (response.type === "interact_response") {
        const events = response.events as WireMessage[];
        const inputEvents = events.filter((e) => e["family"] === "input");
        expect(inputEvents.length).toBeGreaterThan(0);
        // Each character produces an input event
        expect(inputEvents[0]?.["id"]).toBe("input");
      }
    } finally {
      transport.close();
    }
  });

  test("checkbox toggle produces toggle event", async () => {
    const transport = new SpawnTransport({
      binary: binaryPath!,
      format: "json",
      args: ["--mock"],
    });

    try {
      const helloPromise = waitForMessage(transport, (d) => d.type === "hello");
      transport.send(encodeSettings("", {}) as Record<string, unknown>);
      await helloPromise;

      transport.send(
        encodeSnapshot("", {
          id: "main",
          type: "window",
          props: { title: "Test" },
          children: [
            {
              id: "check",
              type: "checkbox",
              props: { label: "Agree", checked: false },
              children: [],
            },
          ],
        }) as Record<string, unknown>,
      );

      const togglePromise = waitForMessage(transport, (d) => d.type === "interact_response");
      transport.send(
        encodeInteract(
          "",
          "i2",
          "toggle",
          { by: "id", value: "check", window_id: "main" },
          { value: true },
        ) as Record<string, unknown>,
      );
      const response = await togglePromise;

      if (response.type === "interact_response") {
        const events = response.events as WireMessage[];
        const toggleEvent = events.find((e) => e["family"] === "toggle");
        expect(toggleEvent).toBeDefined();
        expect(toggleEvent?.["id"]).toBe("check");
      }
    } finally {
      transport.close();
    }
  });

  test("reset clears session state", async () => {
    const transport = new SpawnTransport({
      binary: binaryPath!,
      format: "json",
      args: ["--mock"],
    });

    try {
      const helloPromise = waitForMessage(transport, (d) => d.type === "hello");
      transport.send(encodeSettings("", {}) as Record<string, unknown>);
      await helloPromise;

      // Send a tree
      transport.send(
        encodeSnapshot("", {
          id: "root",
          type: "text",
          props: { content: "before reset" },
          children: [],
        }) as Record<string, unknown>,
      );

      // Reset
      const resetPromise = waitForMessage(transport, (d) => d.type === "reset_response");
      transport.send({ type: "reset", session: "", id: "r1" });
      const resetResp = await resetPromise;

      expect(resetResp.type).toBe("reset_response");

      // After reset, query should find nothing (no tree)
      const queryPromise = waitForMessage(transport, (d) => d.type === "query_response");
      transport.send({
        type: "query",
        session: "",
        id: "q1",
        target: "find",
        selector: { by: "id", value: "root" },
      });
      const qResp = await queryPromise;

      if (qResp.type === "query_response") {
        expect(qResp.data).toBeNull();
      }
    } finally {
      transport.close();
    }
  });

  test("slider interact produces slide event", async () => {
    const transport = new SpawnTransport({
      binary: binaryPath!,
      format: "json",
      args: ["--mock"],
    });

    try {
      const helloPromise = waitForMessage(transport, (d) => d.type === "hello");
      transport.send(encodeSettings("", {}) as Record<string, unknown>);
      await helloPromise;

      transport.send(
        encodeSnapshot("", {
          id: "main",
          type: "window",
          props: { title: "Test" },
          children: [
            {
              id: "vol",
              type: "slider",
              props: { value: 50, min: 0, max: 100, step: 1 },
              children: [],
            },
          ],
        }) as Record<string, unknown>,
      );

      const slidePromise = waitForMessage(transport, (d) => d.type === "interact_response");
      transport.send(
        encodeInteract(
          "",
          "s1",
          "slide",
          { by: "id", value: "vol", window_id: "main" },
          { value: 75 },
        ) as Record<string, unknown>,
      );
      const response = await slidePromise;

      expect(response.type).toBe("interact_response");
      if (response.type === "interact_response") {
        expect(response.id).toBe("s1");
        const events = response.events as WireMessage[];
        const slideEvent = events.find((e) => e["family"] === "slide");
        expect(slideEvent).toBeDefined();
        expect(slideEvent?.["id"]).toBe("vol");
      }
    } finally {
      transport.close();
    }
  });

  test("subscribe and unsubscribe for key press", async () => {
    const transport = new SpawnTransport({
      binary: binaryPath!,
      format: "json",
      args: ["--mock"],
    });

    try {
      const helloPromise = waitForMessage(transport, (d) => d.type === "hello");
      transport.send(encodeSettings("", {}) as Record<string, unknown>);
      await helloPromise;

      // Subscribe to key press events -- no error expected
      transport.send(encodeSubscribe("", "on_key_press", "keys") as Record<string, unknown>);

      // Unsubscribe -- no error expected
      transport.send(encodeUnsubscribe("", "on_key_press") as Record<string, unknown>);

      // Send a snapshot and query to verify the session is still healthy
      transport.send(
        encodeSnapshot("", {
          id: "root",
          type: "text",
          props: { content: "alive" },
          children: [],
        }) as Record<string, unknown>,
      );

      const queryPromise = waitForMessage(transport, (d) => d.type === "query_response");
      transport.send(
        encodeQuery("", "q1", "find", { by: "id", value: "root" }) as Record<string, unknown>,
      );
      const qResp = await queryPromise;

      expect(qResp.type).toBe("query_response");
      if (qResp.type === "query_response") {
        expect(qResp.data).not.toBeNull();
      }
    } finally {
      transport.close();
    }
  });

  test("patch updates props incrementally", async () => {
    const transport = new SpawnTransport({
      binary: binaryPath!,
      format: "json",
      args: ["--mock"],
    });

    try {
      const helloPromise = waitForMessage(transport, (d) => d.type === "hello");
      transport.send(encodeSettings("", {}) as Record<string, unknown>);
      await helloPromise;

      // Send initial snapshot
      transport.send(
        encodeSnapshot("", {
          id: "root",
          type: "column",
          props: {},
          children: [{ id: "label", type: "text", props: { content: "before" }, children: [] }],
        }) as Record<string, unknown>,
      );

      // Send a patch to update the text content
      const patchOps: WirePatchOp[] = [
        { op: "update_props", path: [0], props: { content: "after" } },
      ];
      transport.send(encodePatch("", patchOps) as Record<string, unknown>);

      // Query to verify the prop changed
      const queryPromise = waitForMessage(transport, (d) => d.type === "query_response");
      transport.send(
        encodeQuery("", "q1", "find", { by: "id", value: "label" }) as Record<string, unknown>,
      );
      const qResp = await queryPromise;

      expect(qResp.type).toBe("query_response");
      if (qResp.type === "query_response") {
        expect(qResp.data).not.toBeNull();
        const node = qResp.data as Record<string, unknown>;
        const props = node["props"] as Record<string, unknown>;
        expect(props["content"]).toBe("after");
      }
    } finally {
      transport.close();
    }
  });

  test("tree_hash returns a hash for the current tree", async () => {
    const transport = new SpawnTransport({
      binary: binaryPath!,
      format: "json",
      args: ["--mock"],
    });

    try {
      const helloPromise = waitForMessage(transport, (d) => d.type === "hello");
      transport.send(encodeSettings("", {}) as Record<string, unknown>);
      await helloPromise;

      // Send a snapshot
      transport.send(
        encodeSnapshot("", {
          id: "root",
          type: "column",
          props: {},
          children: [{ id: "msg", type: "text", props: { content: "hash me" }, children: [] }],
        }) as Record<string, unknown>,
      );

      // Request tree hash
      const hashPromise = waitForMessage(transport, (d) => d.type === "tree_hash_response");
      transport.send(encodeTreeHash("", "h1", "test_hash") as Record<string, unknown>);
      const hashResp = await hashPromise;

      expect(hashResp.type).toBe("tree_hash_response");
      if (hashResp.type === "tree_hash_response") {
        expect(hashResp.id).toBe("h1");
        expect(hashResp.name).toBe("test_hash");
        expect(hashResp.hash).toBeTypeOf("string");
        expect(hashResp.hash.length).toBeGreaterThan(0);
      }
    } finally {
      transport.close();
    }
  });

  test("multiple sessions interact independently", async () => {
    const transport = new SpawnTransport({
      binary: binaryPath!,
      format: "json",
      args: ["--mock", "--max-sessions", "4"],
    });

    try {
      const helloPromise = waitForMessage(transport, (d) => d.type === "hello");
      transport.send(encodeSettings("", {}) as Record<string, unknown>);
      await helloPromise;

      // Send different trees to two named sessions
      transport.send(
        encodeSnapshot("s1", {
          id: "root",
          type: "text",
          props: { content: "session one" },
          children: [],
        }) as Record<string, unknown>,
      );

      transport.send(
        encodeSnapshot("s2", {
          id: "root",
          type: "text",
          props: { content: "session two" },
          children: [],
        }) as Record<string, unknown>,
      );

      // Query session 1
      const q1Promise = waitForMessage(
        transport,
        (d) => d.type === "query_response" && "id" in d && d.id === "q1",
      );
      transport.send({
        type: "query",
        session: "s1",
        id: "q1",
        target: "find",
        selector: { by: "id", value: "root" },
      });
      const q1Resp = await q1Promise;

      // Query session 2
      const q2Promise = waitForMessage(
        transport,
        (d) => d.type === "query_response" && "id" in d && d.id === "q2",
      );
      transport.send({
        type: "query",
        session: "s2",
        id: "q2",
        target: "find",
        selector: { by: "id", value: "root" },
      });
      const q2Resp = await q2Promise;

      // Verify each session has its own tree
      if (q1Resp.type === "query_response") {
        const node = q1Resp.data as Record<string, unknown>;
        const props = node["props"] as Record<string, unknown>;
        expect(props["content"]).toBe("session one");
      }

      if (q2Resp.type === "query_response") {
        const node = q2Resp.data as Record<string, unknown>;
        const props = node["props"] as Record<string, unknown>;
        expect(props["content"]).toBe("session two");
      }
    } finally {
      transport.close();
    }
  });
});
