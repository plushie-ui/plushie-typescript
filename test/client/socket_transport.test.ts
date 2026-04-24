import { beforeEach, describe, expect, test, vi } from "vitest";

const { createConnectionMock } = vi.hoisted(() => ({
  createConnectionMock: vi.fn(),
}));

vi.mock("node:net", () => ({
  createConnection: createConnectionMock,
}));

import { SocketTransport } from "../../src/client/socket_transport.js";

function fakeSocket() {
  type Handler = (...args: unknown[]) => void;
  const handlers = new Map<string, Handler[]>();
  const socket = {
    writable: true,
    on: vi.fn((event: string, handler: Handler) => {
      const eventHandlers = handlers.get(event) ?? [];
      eventHandlers.push(handler);
      handlers.set(event, eventHandlers);
      return socket;
    }),
    write: vi.fn(),
    end: vi.fn(),
    emit(event: string, ...args: unknown[]) {
      for (const handler of handlers.get(event) ?? []) {
        handler(...args);
      }
    },
  };
  return socket;
}

function socketError(message: string, code: string): Error & { code: string } {
  const error = new Error(message) as Error & { code: string };
  error.code = code;
  return error;
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

describe("SocketTransport close reporting", () => {
  beforeEach(() => {
    createConnectionMock.mockReset();
  });

  test("reports connection failure before connect and includes the error code", () => {
    const socket = fakeSocket();
    const closeHandler = vi.fn();
    createConnectionMock.mockReturnValue(socket);

    const transport = new SocketTransport({ address: ":9000" });
    transport.onClose(closeHandler);
    socket.emit("error", socketError("connect ECONNREFUSED 127.0.0.1:9000", "ECONNREFUSED"));

    expect(closeHandler).toHaveBeenCalledWith(
      "Socket connection failed (ECONNREFUSED): connect ECONNREFUSED 127.0.0.1:9000",
    );
  });

  test("reports connection loss after connect and includes the error code", () => {
    const socket = fakeSocket();
    const closeHandler = vi.fn();
    createConnectionMock.mockReturnValue(socket);

    const transport = new SocketTransport({ address: ":9000" });
    transport.onClose(closeHandler);
    socket.emit("connect");
    socket.emit("error", socketError("read ECONNRESET", "ECONNRESET"));

    expect(closeHandler).toHaveBeenCalledWith(
      "Socket connection lost (ECONNRESET): read ECONNRESET",
    );
  });

  test("reports close before connection is established", () => {
    const socket = fakeSocket();
    const closeHandler = vi.fn();
    createConnectionMock.mockReturnValue(socket);

    const transport = new SocketTransport({ address: ":9000" });
    transport.onClose(closeHandler);
    socket.emit("close");

    expect(closeHandler).toHaveBeenCalledWith("Socket connection closed before establishment");
  });

  test("reports early close when handler is registered later", () => {
    const socket = fakeSocket();
    const closeHandler = vi.fn();
    createConnectionMock.mockReturnValue(socket);

    const transport = new SocketTransport({ address: ":9000" });
    socket.emit("close");
    transport.onClose(closeHandler);

    expect(closeHandler).toHaveBeenCalledWith("Socket connection closed before establishment");
  });

  test("reports close after connection is established", () => {
    const socket = fakeSocket();
    const closeHandler = vi.fn();
    createConnectionMock.mockReturnValue(socket);

    const transport = new SocketTransport({ address: ":9000" });
    transport.onClose(closeHandler);
    socket.emit("connect");
    socket.emit("close");

    expect(closeHandler).toHaveBeenCalledWith("Socket connection lost: socket closed");
  });

  test("reports early connection failure when handler is registered later", () => {
    const socket = fakeSocket();
    const closeHandler = vi.fn();
    createConnectionMock.mockReturnValue(socket);

    const transport = new SocketTransport({ address: ":9000" });
    socket.emit("error", socketError("connect ECONNREFUSED 127.0.0.1:9000", "ECONNREFUSED"));
    transport.onClose(closeHandler);
    socket.emit("close");

    expect(closeHandler).toHaveBeenCalledTimes(1);
    expect(closeHandler).toHaveBeenCalledWith(
      "Socket connection failed (ECONNREFUSED): connect ECONNREFUSED 127.0.0.1:9000",
    );
  });

  test("does not report close after explicit close", () => {
    const socket = fakeSocket();
    const closeHandler = vi.fn();
    createConnectionMock.mockReturnValue(socket);

    const transport = new SocketTransport({ address: ":9000" });
    transport.onClose(closeHandler);
    transport.close();
    socket.emit("close");

    expect(closeHandler).not.toHaveBeenCalled();
  });

  test("reports only once when error is followed by close", () => {
    const socket = fakeSocket();
    const closeHandler = vi.fn();
    createConnectionMock.mockReturnValue(socket);

    const transport = new SocketTransport({ address: ":9000" });
    transport.onClose(closeHandler);
    socket.emit("error", socketError("connect ECONNREFUSED 127.0.0.1:9000", "ECONNREFUSED"));
    socket.emit("close");

    expect(closeHandler).toHaveBeenCalledTimes(1);
    expect(closeHandler).toHaveBeenCalledWith(
      "Socket connection failed (ECONNREFUSED): connect ECONNREFUSED 127.0.0.1:9000",
    );
  });
});
