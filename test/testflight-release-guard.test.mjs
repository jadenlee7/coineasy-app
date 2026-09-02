import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Build 112 TestFlight path is Apple Internal Only', () => {
  const app = JSON.parse(
    readFileSync(new URL('../app.json', import.meta.url), 'utf8'),
  );
  const eas = JSON.parse(
    readFileSync(new URL('../eas.json', import.meta.url), 'utf8'),
  );
  const workflow = readFileSync(
    new URL('../.eas/build/testflight-internal-ios.yml', import.meta.url),
    'utf8',
  );

  assert.equal(app.expo.ios.buildNumber, '112');
  assert.equal(eas.cli.requireCommit, true);
  assert.equal(eas.build.testflight.env.EASYGO_DEPLOY_TARGET, 'staging');
  assert.equal(
    eas.build.testflight.ios.config,
    'testflight-internal-ios.yml',
  );
  assert.equal(eas.build.production, undefined);
  assert.equal(eas.submit.production, undefined);
  assert.ok(eas.submit.testflight);

  assert.match(workflow, /testFlightInternalTestingOnly:\s*true/);
  assert.doesNotMatch(workflow, /testFlightInternalTestingOnly:\s*false/);
  assert.ok(
    workflow.indexOf('node scripts/mobile-preflight.mjs --target=staging')
      < workflow.indexOf('eas/install_node_modules'),
  );
  assert.match(workflow, /eas\/generate_gymfile_from_template/);
  assert.match(workflow, /eas\/run_fastlane/);
  assert.match(workflow, /eas\/find_and_upload_build_artifacts/);
});
