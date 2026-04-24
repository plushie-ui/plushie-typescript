import type { TestSession } from "./session.js";

export type VitestLikeTestApi = ((...args: any[]) => unknown) & object;

type CreateSession<M> = () => Promise<TestSession<M>>;

const chainableKeys = new Set<PropertyKey>([
  "concurrent",
  "fails",
  "only",
  "sequential",
  "skip",
  "todo",
]);

const apiFactoryKeys = new Set<PropertyKey>(["extend", "runIf", "skipIf"]);

export function createTestWithApi<M>(
  testApi: VitestLikeTestApi,
  createSession: CreateSession<M>,
): VitestLikeTestApi {
  return wrapTestApi(testApi, createSession, new WeakMap());
}

function wrapTestApi<M>(
  testApi: VitestLikeTestApi,
  createSession: CreateSession<M>,
  seen: WeakMap<object, VitestLikeTestApi>,
): VitestLikeTestApi {
  const existing = seen.get(testApi);
  if (existing) return existing;

  const wrapped = function plushieTest(...args: unknown[]): unknown {
    return testApi(...wrapTestArgs(args, createSession));
  } as unknown as VitestLikeTestApi;

  seen.set(testApi, wrapped);

  for (const key of Reflect.ownKeys(testApi)) {
    if (key === "length" || key === "name" || key === "prototype") continue;

    const descriptor = Object.getOwnPropertyDescriptor(testApi, key);
    if (!descriptor) continue;

    Object.defineProperty(
      wrapped,
      key,
      wrapPropertyDescriptor(testApi, key, descriptor, createSession, seen),
    );
  }

  return wrapped;
}

function wrapPropertyDescriptor<M>(
  testApi: VitestLikeTestApi,
  key: PropertyKey,
  descriptor: PropertyDescriptor,
  createSession: CreateSession<M>,
  seen: WeakMap<object, VitestLikeTestApi>,
): PropertyDescriptor {
  const wrappedDescriptor: PropertyDescriptor = { ...descriptor };

  if (descriptor.get) {
    const get = descriptor.get;
    wrappedDescriptor.get = function getWrappedProperty() {
      return wrapApiResult(key, get.call(testApi), createSession, seen);
    };
  }

  if (descriptor.set) {
    const set = descriptor.set;
    wrappedDescriptor.set = function setWrappedProperty(value: unknown) {
      set.call(testApi, value);
    };
  }

  if ("value" in descriptor && typeof descriptor.value === "function") {
    const value = descriptor.value as VitestLikeTestApi;

    if (chainableKeys.has(key)) {
      wrappedDescriptor.value = wrapTestApi(value, createSession, seen);
    } else {
      wrappedDescriptor.value = function callWrappedMethod(...args: unknown[]) {
        const result = value.apply(testApi, args);
        return wrapApiResult(key, result, createSession, seen);
      };
    }
  }

  return wrappedDescriptor;
}

function wrapApiResult<M>(
  key: PropertyKey,
  result: unknown,
  createSession: CreateSession<M>,
  seen: WeakMap<object, VitestLikeTestApi>,
): unknown {
  if (typeof result !== "function") return result;

  if (chainableKeys.has(key) || apiFactoryKeys.has(key)) {
    return wrapTestApi(result as VitestLikeTestApi, createSession, seen);
  }

  return result;
}

function wrapTestArgs<M>(args: unknown[], createSession: CreateSession<M>): unknown[] {
  const fnIndex = testFunctionIndex(args);
  if (fnIndex === null) return args;

  const wrappedArgs = [...args];
  const fn = wrappedArgs[fnIndex] as (ctx: Record<string, unknown>) => unknown;

  wrappedArgs[fnIndex] = async (ctx: Record<string, unknown> = {}) => {
    const session = await createSession();

    let result: unknown;
    try {
      result = await fn({ ...ctx, session });
    } catch (testError) {
      try {
        await session.stopAndWait();
      } catch (cleanupError) {
        throw new AggregateError(
          [testError, cleanupError],
          "test failed and session cleanup failed",
        );
      }
      throw testError;
    }

    await session.stopAndWait();
    return result;
  };

  return wrappedArgs;
}

function testFunctionIndex(args: unknown[]): number | null {
  if (typeof args[1] === "function") return 1;
  if (typeof args[2] === "function") return 2;
  return null;
}
