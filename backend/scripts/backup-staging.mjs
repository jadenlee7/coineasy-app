import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import {
  createReadStream,
  createWriteStream,
  promises as fs,
} from 'node:fs';
import path from 'node:path';
import { finished } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const projectId = 'cad97a26-a680-4b8e-a366-f15b0412244f';
const environmentId = 'f59e8f5a-406d-410f-a273-0020089860cd';
const postgresServiceId = '16994f70-8e17-47f7-bb50-55ac211af412';
const volumeId = 'b3bd748e-762d-4fba-80e0-783f91dad261';
const volumeMountPath = '/var/lib/postgresql/data';
const keychainAccount = 'coineasy';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '../..');
const backupDir = path.join(projectRoot, '.secure-backups');
const createdAt = new Date().toISOString();
const timestamp = createdAt.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const backupName = `easygo-staging-${timestamp}.dump.enc`;
const backupPath = path.join(backupDir, backupName);
const metadataPath = `${backupPath}.json`;
const keychainService = `easygo-staging-postgres-backup-${timestamp}`;
const passphrase = randomBytes(32).toString('base64url');

let keychainStored = false;

function waitForChild(child) {
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal }));
  });
}

function captureDiagnostic(stream) {
  let diagnostic = '';
  stream.on('data', (chunk) => {
    if (diagnostic.length < 4096) {
      diagnostic += chunk.toString('utf8').slice(0, 4096 - diagnostic.length);
    }
  });
  return () => diagnostic.trim();
}

async function runCapture(command, args) {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  const stdout = [];
  const stderr = [];
  child.stdout.on('data', (chunk) => stdout.push(chunk));
  child.stderr.on('data', (chunk) => stderr.push(chunk));
  const result = await waitForChild(child);
  if (result.code !== 0) {
    throw new Error(`${command} exited with code ${result.code}.`);
  }
  return {
    stdout: Buffer.concat(stdout),
    stderr: Buffer.concat(stderr),
  };
}

async function verifyRailwayTarget() {
  const { stdout } = await runCapture('railway', ['status', '--json']);
  const project = JSON.parse(stdout.toString('utf8'));
  if (project.id !== projectId) {
    throw new Error('Railway CLI is not linked to the EasyGo staging project.');
  }

  const environment = project.environments.edges
    .map((edge) => edge.node)
    .find((candidate) => candidate.id === environmentId);
  if (!environment || environment.name !== 'staging') {
    throw new Error('The dedicated EasyGo staging environment was not found.');
  }

  const volume = environment.volumeInstances.edges
    .map((edge) => edge.node)
    .find((candidate) => candidate.volume.id === volumeId);
  if (
    !volume ||
    volume.serviceId !== postgresServiceId ||
    volume.mountPath !== volumeMountPath ||
    volume.state !== 'READY'
  ) {
    throw new Error('The EasyGo staging Postgres volume is not ready.');
  }

  return volume;
}

async function storePassphrase() {
  const child = spawn(
    'security',
    [
      'add-generic-password',
      '-U',
      '-a',
      keychainAccount,
      '-s',
      keychainService,
      '-w',
      passphrase,
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
  captureDiagnostic(child.stderr);
  const result = await waitForChild(child);
  if (result.code !== 0) {
    throw new Error('Could not store the backup passphrase in macOS Keychain.');
  }
  keychainStored = true;
}

async function createEncryptedDump() {
  const dump = spawn(
    'railway',
    [
      'ssh',
      '--project',
      projectId,
      '--environment',
      environmentId,
      '--service',
      postgresServiceId,
      'pg_dump',
      '--format=custom',
      '--no-owner',
      '--no-privileges',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const encrypt = spawn(
    'openssl',
    [
      'enc',
      '-aes-256-cbc',
      '-salt',
      '-pbkdf2',
      '-iter',
      '200000',
      '-pass',
      'env:EASYGO_BACKUP_PASSPHRASE',
    ],
    {
      env: { ...process.env, EASYGO_BACKUP_PASSPHRASE: passphrase },
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );
  const output = createWriteStream(backupPath, {
    flags: 'wx',
    mode: 0o600,
  });
  const dumpDiagnostic = captureDiagnostic(dump.stderr);
  const encryptDiagnostic = captureDiagnostic(encrypt.stderr);

  let rawBytes = 0;
  let dumpHeader = Buffer.alloc(0);
  dump.stdout.on('data', (chunk) => {
    rawBytes += chunk.length;
    if (dumpHeader.length < 5) {
      dumpHeader = Buffer.concat([dumpHeader, chunk]).subarray(0, 5);
    }
  });

  dump.stdout.pipe(encrypt.stdin);
  encrypt.stdout.pipe(output);

  const [dumpResult, encryptResult] = await Promise.all([
    waitForChild(dump),
    waitForChild(encrypt),
    finished(output),
  ]);

  if (dumpResult.code !== 0) {
    throw new Error(`Remote pg_dump failed. ${dumpDiagnostic()}`.trim());
  }
  if (encryptResult.code !== 0) {
    throw new Error(`Backup encryption failed. ${encryptDiagnostic()}`.trim());
  }
  if (dumpHeader.toString('ascii') !== 'PGDMP' || rawBytes === 0) {
    throw new Error('Remote output was not a PostgreSQL custom-format dump.');
  }

  return rawBytes;
}

async function verifyEncryptedDump(expectedRawBytes) {
  const decrypt = spawn(
    'openssl',
    [
      'enc',
      '-d',
      '-aes-256-cbc',
      '-pbkdf2',
      '-iter',
      '200000',
      '-pass',
      'env:EASYGO_BACKUP_PASSPHRASE',
    ],
    {
      env: { ...process.env, EASYGO_BACKUP_PASSPHRASE: passphrase },
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );
  createReadStream(backupPath).pipe(decrypt.stdin);
  const decryptDiagnostic = captureDiagnostic(decrypt.stderr);

  let rawBytes = 0;
  let dumpHeader = Buffer.alloc(0);
  decrypt.stdout.on('data', (chunk) => {
    rawBytes += chunk.length;
    if (dumpHeader.length < 5) {
      dumpHeader = Buffer.concat([dumpHeader, chunk]).subarray(0, 5);
    }
  });

  const result = await waitForChild(decrypt);
  if (
    result.code !== 0 ||
    dumpHeader.toString('ascii') !== 'PGDMP' ||
    rawBytes !== expectedRawBytes
  ) {
    throw new Error(
      `Encrypted backup round-trip verification failed. ${decryptDiagnostic()}`.trim(),
    );
  }
}

async function sha256(filePath) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk);
  }
  return hash.digest('hex');
}

async function cleanup() {
  await Promise.allSettled([
    fs.unlink(backupPath),
    fs.unlink(metadataPath),
  ]);
  if (keychainStored) {
    const child = spawn(
      'security',
      [
        'delete-generic-password',
        '-a',
        keychainAccount,
        '-s',
        keychainService,
      ],
      { stdio: 'ignore' },
    );
    await waitForChild(child).catch(() => {});
  }
}

try {
  const volume = await verifyRailwayTarget();
  await fs.mkdir(backupDir, { recursive: true, mode: 0o700 });
  await storePassphrase();
  const rawBytes = await createEncryptedDump();
  await verifyEncryptedDump(rawBytes);

  const encrypted = await fs.stat(backupPath);
  const metadata = {
    createdAt,
    projectId,
    environmentId,
    postgresServiceId,
    volumeId,
    volumeCurrentSizeMB: volume.currentSizeMB,
    backupFile: backupName,
    encryptedBytes: encrypted.size,
    rawBytes,
    sha256: await sha256(backupPath),
    encryption: 'AES-256-CBC, PBKDF2, 200000 iterations',
    keychainAccount,
    keychainService,
    verified: true,
  };
  await fs.writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, {
    flag: 'wx',
    mode: 0o600,
  });
  console.log(JSON.stringify(metadata, null, 2));
} catch (error) {
  await cleanup();
  throw error;
}
