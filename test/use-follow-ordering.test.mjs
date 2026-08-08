import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function sameDependencies(left, right) {
  return Boolean(
    left
    && right
    && left.length === right.length
    && left.every((value, index) => Object.is(value, right[index])),
  );
}

function createHookRuntime(api, initialLease) {
  const slots = [];
  let currentLease = initialLease;
  let cursor = 0;
  let pendingEffects = [];

  const isCurrentLease = (candidate) => candidate === currentLease;

  function useState(initialValue) {
    const index = cursor++;
    if (!slots[index]) {
      const slot = {
        value: typeof initialValue === 'function' ? initialValue() : initialValue,
      };
      slot.setValue = (nextValue) => {
        slot.value = typeof nextValue === 'function' ? nextValue(slot.value) : nextValue;
      };
      slots[index] = slot;
    }
    return [slots[index].value, slots[index].setValue];
  }

  function useRef(initialValue) {
    const index = cursor++;
    if (!slots[index]) slots[index] = { current: initialValue };
    return slots[index];
  }

  function useCallback(callback, dependencies) {
    const index = cursor++;
    const previous = slots[index];
    if (!previous || !sameDependencies(previous.dependencies, dependencies)) {
      slots[index] = { callback, dependencies };
    }
    return slots[index].callback;
  }

  function useEffect(effect, dependencies) {
    const index = cursor++;
    const previous = slots[index];
    if (!previous || !sameDependencies(previous.dependencies, dependencies)) {
      pendingEffects.push({ dependencies, effect, index, previous });
    }
  }

  function commitEffects() {
    const effects = pendingEffects;
    pendingEffects = [];
    for (const pending of effects) {
      pending.previous?.cleanup?.();
      const cleanup = pending.effect();
      slots[pending.index] = {
        cleanup: typeof cleanup === 'function' ? cleanup : null,
        dependencies: pending.dependencies,
      };
    }
  }

  return {
    globals: {
      api,
      isCurrentLease,
      useCallback,
      useDeviceAccountOperationLease: () => ({
        lease: currentLease,
        isCurrentLease,
      }),
      useEffect,
      useRef,
      useState,
    },
    render(useFollow, targetUserId, options) {
      cursor = 0;
      const result = useFollow(targetUserId, options);
      commitEffects();
      return result;
    },
    setLease(nextLease) {
      currentLease = nextLease;
    },
  };
}

let moduleSequence = 0;
async function loadUseFollow(globals) {
  let source = readFileSync(new URL('../hooks/useFollow.js', import.meta.url), 'utf8');
  source = source
    .replace(
      /import \{ useCallback, useEffect, useRef, useState \} from "react";/,
      'const { useCallback, useEffect, useRef, useState } = globalThis.__easyGoFollowTest;',
    )
    .replace(
      /import \{ useDeviceAccountOperationLease \} from "\.\.\/contexts\/DeviceAccountDataContext";/,
      'const { useDeviceAccountOperationLease } = globalThis.__easyGoFollowTest;',
    )
    .replace(
      /import \{ api \} from "\.\.\/utils\/api";/,
      'const { api } = globalThis.__easyGoFollowTest;',
    );

  globalThis.__easyGoFollowTest = globals;
  try {
    const encoded = Buffer.from(source).toString('base64');
    const loaded = await import(`data:text/javascript;base64,${encoded}#${moduleSequence++}`);
    return loaded.useFollow;
  } finally {
    delete globalThis.__easyGoFollowTest;
  }
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

async function flushMicrotasks(turns = 8) {
  for (let index = 0; index < turns; index += 1) await Promise.resolve();
}

for (const scenario of [
  { mutation: 'follow', initialFollowing: false, committedFollowing: true },
  { mutation: 'unfollow', initialFollowing: true, committedFollowing: false },
]) {
  test(`status refresh waits for an in-flight ${scenario.mutation} commit`, async () => {
    const lease = Object.freeze({ ownerUserId: 'did:privy:owner-a', sessionEpoch: 1 });
    const mutationGate = deferred();
    let committedFollowing = scenario.initialFollowing;
    let statusCalls = 0;
    const mutate = async () => {
      await mutationGate.promise;
      committedFollowing = scenario.committedFollowing;
      return { following: committedFollowing };
    };
    const api = {
      follows: {
        follow: scenario.mutation === 'follow' ? mutate : async () => ({ following: true }),
        status: async () => {
          statusCalls += 1;
          return { following: committedFollowing };
        },
        unfollow: scenario.mutation === 'unfollow' ? mutate : async () => ({ following: false }),
      },
    };
    const runtime = createHookRuntime(api, lease);
    const useFollow = await loadUseFollow(runtime.globals);
    let hook = runtime.render(useFollow, 'user-b', {
      initialFollowing: scenario.initialFollowing,
      loadStatus: true,
    });
    await flushMicrotasks();
    hook = runtime.render(useFollow, 'user-b', {
      initialFollowing: scenario.initialFollowing,
      loadStatus: true,
    });
    assert.equal(hook.isFollowing, scenario.initialFollowing);
    assert.equal(statusCalls, 1);

    const mutationResult = hook[scenario.mutation]();
    await flushMicrotasks();
    const refreshResult = hook.refresh();
    await flushMicrotasks();

    assert.equal(statusCalls, 1, 'status must not execute before the queued mutation commits');
    mutationGate.resolve();
    assert.equal(await mutationResult, true);
    assert.equal(await refreshResult, scenario.committedFollowing);

    hook = runtime.render(useFollow, 'user-b', {
      initialFollowing: scenario.initialFollowing,
      loadStatus: true,
    });
    assert.equal(statusCalls, 2);
    assert.equal(hook.isFollowing, scenario.committedFollowing);
    assert.equal(hook.loading, false);
  });
}

for (const transition of ['target', 'session']) {
  test(`${transition} transition resolves an in-flight follow with the stale null sentinel`, async () => {
    const firstLease = Object.freeze({ ownerUserId: 'did:privy:owner-a', sessionEpoch: 1 });
    const secondLease = transition === 'session'
      ? Object.freeze({ ownerUserId: 'did:privy:owner-a', sessionEpoch: 2 })
      : firstLease;
    const mutationGate = deferred();
    const api = {
      follows: {
        follow: async () => {
          await mutationGate.promise;
          return { following: true };
        },
        status: async () => ({ following: false }),
        unfollow: async () => ({ following: false }),
      },
    };
    const runtime = createHookRuntime(api, firstLease);
    const useFollow = await loadUseFollow(runtime.globals);
    let hook = runtime.render(useFollow, 'user-b', { loadStatus: false });
    await flushMicrotasks();

    const followResult = hook.follow();
    await flushMicrotasks();
    runtime.setLease(secondLease);
    hook = runtime.render(
      useFollow,
      transition === 'target' ? 'user-c' : 'user-b',
      { loadStatus: false },
    );
    await flushMicrotasks();
    hook = runtime.render(
      useFollow,
      transition === 'target' ? 'user-c' : 'user-b',
      { loadStatus: false },
    );
    assert.equal(hook.isFollowing, false);
    assert.equal(hook.loading, false, 'the replacement binding must not wait on the stale queue');

    mutationGate.resolve();

    assert.equal(await followResult, null);
    await flushMicrotasks();
    hook = runtime.render(
      useFollow,
      transition === 'target' ? 'user-c' : 'user-b',
      { loadStatus: false },
    );
    assert.equal(hook.isFollowing, false);
  });
}
