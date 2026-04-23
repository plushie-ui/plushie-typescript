import { beforeEach, describe, expect, test, vi } from "vitest";

const { createConnectionMock } = vi.hoisted(() => ({
  createConnectionMock: vi.fn(),
}));

vi.mock("node:net", () => ({
  createConnection: createConnectionMock,
}));

import { SocketTransport } from "../../src/client/socket_transport.js";

function fakeSocket() {
  return {
    writable: true,
    on: vi.fn().mockReturnThis(),
    write: vi.fn(),
    end: vi.fn(),
  };
}

describe("SocketTransport address parsing", () => {
  beforeEach(() => {
    createConnectionMock.mockReset();
    createConnectionMock.mockReturnValue(fakeSocket());
  });

  test("treats /path as a Unix socket", () => {
    new SocketTransport({ address: "/tmp/plushie.sock" });

    expect(createConnectionMock).toHaveBeenCalledWith({ path: "/tmp/plushie.sock" });
  });

  test("treats relative socket paths as Unix socket paths", () => {
    new SocketTransport({ address: "tmp/plushie.sock" });

    expect(createConnectionMock).toHaveBeenCalledWith({ path: "tmp/plushie.sock" });
  });

  test("treats Windows drive-letter paths as local socket paths", () => {
    new SocketTransport({ address: String.raw`C:\tmp\plushie.sock` });

    expect(createConnectionMock).toHaveBeenCalledWith({ path: String.raw`C:\tmp\plushie.sock` });
  });

  test("treats :PORT as localhost TCP", () => {
    new SocketTransport({ address: ":9000" });

    expect(createConnectionMock).toHaveBeenCalledWith({ host: "127.0.0.1", port: 9000 });
  });

  test("treats HOST:PORT as TCP", () => {
    new SocketTransport({ address: "renderer.local:9000" });

    expect(createConnectionMock).toHaveBeenCalledWith({ host: "renderer.local", port: 9000 });
  });

  test("treats bracketed IPv6 with port as TCP and strips brackets", () => {
    new SocketTransport({ address: "[::1]:9000" });

    expect(createConnectionMock).toHaveBeenCalledWith({ host: "::1", port: 9000 });
  });

  test("rejects malformed localhost shorthand without a numeric port", () => {
    expect(() => new SocketTransport({ address: ":abc" })).toThrow('Invalid socket address ":abc"');
    expect(createConnectionMock).not.toHaveBeenCalled();
  });

  test("rejects malformed host:port strings without a numeric port", () => {
    expect(() => new SocketTransport({ address: "localhost:abc" })).toThrow(
      'Invalid socket address "localhost:abc"',
    );
    expect(() => new SocketTransport({ address: "host:" })).toThrow(
      'Invalid socket address "host:"',
    );
    expect(createConnectionMock).not.toHaveBeenCalled();
  });

  test("rejects bare IPv6 literals with port", () => {
    expect(() => new SocketTransport({ address: "::1:9000" })).toThrow(
      'Invalid socket address "::1:9000"',
    );
    expect(createConnectionMock).not.toHaveBeenCalled();
  });

  test("rejects bracketed IPv6 without a port", () => {
    expect(() => new SocketTransport({ address: "[::1]" })).toThrow(
      'Invalid socket address "[::1]"',
    );
    expect(createConnectionMock).not.toHaveBeenCalled();
  });

  test("rejects bracketed IPv6 with a non-numeric port", () => {
    expect(() => new SocketTransport({ address: "[::1]:abc" })).toThrow(
      'Invalid socket address "[::1]:abc"',
    );
    expect(createConnectionMock).not.toHaveBeenCalled();
  });

  test("treats Windows-style pipe paths as local socket paths", () => {
    new SocketTransport({ address: String.raw`\\\\.\\pipe\\plushie-renderer` });

    expect(createConnectionMock).toHaveBeenCalledWith({
      path: String.raw`\\\\.\\pipe\\plushie-renderer`,
    });
  });
});
