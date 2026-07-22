import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const expoDeviceSource = fileURLToPath(
  new URL('../node_modules/expo-device/ios/UIDevice.swift', import.meta.url),
);

const legacyImplementation = `  var isSimulator: Bool {
    return TARGET_OS_SIMULATOR != 0
  }`;

const xcode26Implementation = `  var isSimulator: Bool {
    #if targetEnvironment(simulator)
    return true
    #else
    return false
    #endif
  }`;

const source = await readFile(expoDeviceSource, 'utf8');

if (source.includes(xcode26Implementation)) {
  console.log('expo-device Xcode 26 compatibility patch already applied.');
} else if (source.includes(legacyImplementation)) {
  await writeFile(
    expoDeviceSource,
    source.replace(legacyImplementation, xcode26Implementation),
  );
  console.log('Applied expo-device Xcode 26 compatibility patch.');
} else {
  throw new Error(
    'expo-device UIDevice.swift changed; review the Xcode 26 compatibility patch before building.',
  );
}
