import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createCreatePostHandler,
  createUpdatePostHandler,
} from '../src/routes/posts.js';

function response() {
  return {
    body: null,
    headers: {},
    statusCode: 200,
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(value) {
      this.statusCode = value;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
}

function request(body, { id = 'post_1' } = {}) {
  return {
    body,
    params: { id },
    user: { privyDid: 'did:privy:user-1' },
  };
}

function inaccessibleDatabase() {
  return new Proxy({}, {
    get(_target, property) {
      throw new Error(`database accessed through ${String(property)}`);
    },
  });
}

test('POST create and PUT edit reject the same unsafe body before database access', async () => {
  const rejectedText = 'Ｋ\u200B1.l.l yοurѕééélf';
  const createResponse = response();
  const updateResponse = response();
  const db = inaccessibleDatabase();

  await createCreatePostHandler({ db })(
    request({ body: rejectedText }),
    createResponse,
  );
  await createUpdatePostHandler({ db })(
    request({ body: rejectedText }),
    updateResponse,
  );

  for (const result of [createResponse, updateResponse]) {
    assert.equal(result.statusCode, 422);
    assert.equal(result.headers['Cache-Control'], 'no-store');
    assert.deepEqual(result.body, { error: 'post_content_rejected' });
    assert.equal(JSON.stringify(result.body).includes(rejectedText), false);
  }
  assert.deepEqual(updateResponse.body, createResponse.body);
});

test('POST create and PUT edit use the same injected policy contract exactly once', async () => {
  const inspected = [];
  const inspectContent = (body) => {
    inspected.push(body);
    return { allowed: false, ruleId: 'private_rule_detail', submittedText: body };
  };
  const db = inaccessibleDatabase();
  const createResponse = response();
  const updateResponse = response();

  await createCreatePostHandler({ db, inspectContent })(
    request({ body: 'create candidate' }),
    createResponse,
  );
  await createUpdatePostHandler({ db, inspectContent })(
    request({ body: 'edit candidate' }),
    updateResponse,
  );

  assert.deepEqual(inspected, ['create candidate', 'edit candidate']);
  assert.deepEqual(createResponse.body, { error: 'post_content_rejected' });
  assert.deepEqual(updateResponse.body, { error: 'post_content_rejected' });
  assert.equal(JSON.stringify(createResponse.body).includes('private_rule_detail'), false);
  assert.equal(JSON.stringify(updateResponse.body).includes('edit candidate'), false);
});

test('POST create and PUT edit reject non-null remote media before database access', async () => {
  const mediaUrl = 'https://uploads.invalid/private.png?token=secret';
  const createResponse = response();
  const updateResponse = response();
  const db = inaccessibleDatabase();

  await createCreatePostHandler({ db })(
    request({ body: 'ordinary create', mediaUrl }),
    createResponse,
  );
  await createUpdatePostHandler({ db })(
    request({ body: 'ordinary edit', mediaUrl }),
    updateResponse,
  );

  for (const result of [createResponse, updateResponse]) {
    assert.equal(result.statusCode, 422);
    assert.equal(result.headers['Cache-Control'], 'no-store');
    assert.deepEqual(result.body, { error: 'post_media_rejected' });
    assert.equal(JSON.stringify(result.body).includes(mediaUrl), false);
  }
});

test('POST create stores the original accepted body rather than the safety skeleton', async () => {
  const calls = [];
  const originalBody = 'ＥａｓｙＧｏ community update #오늘';
  const created = { id: 'post_1', body: originalBody, authorId: 'user_1' };
  const db = {
    user: {
      async findUnique(options) {
        calls.push(['user.findUnique', options]);
        return { id: 'user_1' };
      },
    },
    post: {
      async create(options) {
        calls.push(['post.create', options]);
        return created;
      },
    },
  };
  const res = response();

  await createCreatePostHandler({ db, shape: async (row) => row })(
    request({ body: originalBody }),
    res,
  );

  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.body, { post: created });
  assert.equal(calls[1][1].data.body, originalBody);
  assert.deepEqual(calls[1][1].data, {
    authorId: 'user_1',
    body: originalBody,
    parentPostId: null,
    mediaUrl: null,
  });
});

test('PUT edit preserves omitted legacy media and still permits explicit removal', async () => {
  for (const [body, expectedMedia] of [
    [{ body: 'body only edit' }, { present: false }],
    [{ body: 'remove legacy media', mediaUrl: null }, { present: true, value: null }],
  ]) {
    const calls = [];
    let findCalls = 0;
    const updated = { id: 'post_1', authorId: 'user_1', body: body.body };
    const tx = {
      async $queryRawUnsafe() {},
      post: {
        async findUnique() {
          findCalls += 1;
          return findCalls === 1
            ? { id: 'post_1', authorId: 'user_1', contentRevision: 2 }
            : updated;
        },
        async updateMany(options) {
          calls.push(options);
          return { count: 1 };
        },
      },
    };
    const db = {
      user: { async findUnique() { return { id: 'user_1' }; } },
      async $transaction(operation) { return operation(tx); },
    };
    const res = response();

    await createUpdatePostHandler({ db, shape: async (row) => row })(request(body), res);

    assert.equal(res.statusCode, 200);
    assert.equal(Object.hasOwn(calls[0].data, 'mediaUrl'), expectedMedia.present);
    if (expectedMedia.present) assert.equal(calls[0].data.mediaUrl, expectedMedia.value);
  }
});

test('schema failures keep the existing bad_input contract and never invoke safety policy', async () => {
  let inspections = 0;
  const inspectContent = () => {
    inspections += 1;
    return { allowed: true };
  };
  const inspectMedia = () => {
    inspections += 1;
    return { allowed: true };
  };
  const db = inaccessibleDatabase();

  for (const handler of [
    createCreatePostHandler({ db, inspectContent, inspectMedia }),
    createUpdatePostHandler({ db, inspectContent, inspectMedia }),
  ]) {
    const res = response();
    await handler(request({ body: '' }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, 'bad_input');
    assert.equal(Array.isArray(res.body.details), true);
  }
  assert.equal(inspections, 0);
});
