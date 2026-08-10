export const EXPORT_SCOPE = Object.freeze({
  full: 'easygo_local_database',
  social: 'easygo_legacy_social',
});

const EXPORT_FILENAME_PREFIX = Object.freeze({
  [EXPORT_SCOPE.full]: 'easygo-full-data',
  [EXPORT_SCOPE.social]: 'easygo-social-data',
});

let exportFileOperationTail = Promise.resolve();

function enqueueExportFileOperation(operation) {
  const result = exportFileOperationTail.catch(() => {}).then(operation);
  exportFileOperationTail = result.catch(() => {});
  return result;
}

export class DataExportError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'DataExportError';
    this.code = code;
  }
}

export function isEasyGoExportFilename(filename) {
  if (typeof filename !== 'string') return false;
  return /^(easygo-full-data|easygo-social-data)-\d{8}T\d{9}Z\.json$/.test(filename);
}

function requireKnownScope(scope) {
  if (!Object.prototype.hasOwnProperty.call(EXPORT_FILENAME_PREFIX, scope)) {
    throw new DataExportError('unsupported_scope', 'The data export scope is not supported.');
  }
  return scope;
}

function canonicalExportTimestamp(exportedAt) {
  if (typeof exportedAt !== 'string' || !exportedAt.trim()) {
    throw new DataExportError('invalid_exported_at', 'The data export timestamp is invalid.');
  }

  const parsed = new Date(exportedAt);
  if (Number.isNaN(parsed.getTime())) {
    throw new DataExportError('invalid_exported_at', 'The data export timestamp is invalid.');
  }
  return parsed.toISOString();
}

export function validateExportEnvelope(payload, expectedScope) {
  requireKnownScope(expectedScope);

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new DataExportError('invalid_envelope', 'The data export response is invalid.');
  }
  if (!Number.isInteger(payload.schemaVersion) || payload.schemaVersion < 1) {
    throw new DataExportError('invalid_schema_version', 'The data export schema version is invalid.');
  }
  if (payload.scope !== expectedScope) {
    throw new DataExportError('scope_mismatch', 'The data export response has an unexpected scope.');
  }

  canonicalExportTimestamp(payload.exportedAt);

  if (!Object.prototype.hasOwnProperty.call(payload, 'data')
    || !payload.data
    || typeof payload.data !== 'object'
    || Array.isArray(payload.data)) {
    throw new DataExportError('invalid_export_data', 'The data export response has invalid data.');
  }

  return payload;
}

export function serializeExportEnvelope(payload, expectedScope) {
  validateExportEnvelope(payload, expectedScope);
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export function buildExportFilename(scope, exportedAt) {
  requireKnownScope(scope);
  const timestamp = canonicalExportTimestamp(exportedAt)
    .replace(/[-:.]/g, '');
  return `${EXPORT_FILENAME_PREFIX[scope]}-${timestamp}.json`;
}

async function withTemporaryJsonFileUnlocked({
  directory,
  payload,
  expectedScope,
  write,
  share,
  remove,
}) {
  if (typeof directory !== 'string' || !directory.trim()) {
    throw new DataExportError('invalid_directory', 'A temporary export directory is required.');
  }
  if (typeof write !== 'function' || typeof share !== 'function' || typeof remove !== 'function') {
    throw new DataExportError('invalid_file_operations', 'Data export file operations are unavailable.');
  }

  const contents = serializeExportEnvelope(payload, expectedScope);
  const filename = buildExportFilename(expectedScope, payload.exportedAt);
  const separator = directory.endsWith('/') ? '' : '/';
  const uri = `${directory}${separator}${filename}`;
  let primaryError = null;

  try {
    await write(uri, contents);
    return await share(uri, filename);
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    try {
      await remove(uri);
    } catch (cleanupError) {
      throw new DataExportError(
        primaryError ? 'operation_cleanup_failed' : 'cleanup_failed',
        'EasyGo could not verify temporary export cleanup.',
      );
    }
  }
}

export function withTemporaryJsonFile(options) {
  return enqueueExportFileOperation(() => withTemporaryJsonFileUnlocked(options));
}

async function cleanupStaleExportFilesUnlocked({ directory, list, remove }) {
  if (typeof directory !== 'string' || !directory.trim()) return { removed: 0, failed: 0 };
  if (typeof list !== 'function' || typeof remove !== 'function') {
    throw new DataExportError('invalid_file_operations', 'Data export file operations are unavailable.');
  }
  const names = await list(directory);
  const candidates = Array.isArray(names) ? names.filter(isEasyGoExportFilename) : [];
  let removed = 0;
  let failed = 0;
  for (const name of candidates) {
    try {
      const separator = directory.endsWith('/') ? '' : '/';
      await remove(`${directory}${separator}${name}`);
      removed += 1;
    } catch {
      failed += 1;
    }
  }
  return { removed, failed };
}

export function cleanupStaleExportFiles(options) {
  return enqueueExportFileOperation(() => cleanupStaleExportFilesUnlocked(options));
}
