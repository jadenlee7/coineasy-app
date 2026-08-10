import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const patches = [
  {
    name: 'expo-device',
    source: fileURLToPath(
      new URL('../node_modules/expo-device/ios/UIDevice.swift', import.meta.url),
    ),
    legacy: `  var isSimulator: Bool {
    return TARGET_OS_SIMULATOR != 0
  }`,
    replacement: `  var isSimulator: Bool {
    #if targetEnvironment(simulator)
    return true
    #else
    return false
    #endif
  }`,
  },
  {
    name: 'expo-dev-menu',
    source: fileURLToPath(
      new URL(
        '../node_modules/expo-dev-menu/ios/DevMenuViewController.swift',
        import.meta.url,
      ),
    ),
    legacy: '    let isSimulator = TARGET_IPHONE_SIMULATOR > 0',
    replacement: `    #if targetEnvironment(simulator)
    let isSimulator = true
    #else
    let isSimulator = false
    #endif`,
  },
];

for (const patch of patches) {
  const source = await readFile(patch.source, 'utf8');

  if (source.includes(patch.replacement)) {
    console.log(`${patch.name} Xcode 26 compatibility patch already applied.`);
  } else if (source.includes(patch.legacy)) {
    await writeFile(
      patch.source,
      source.replace(patch.legacy, patch.replacement),
    );
    console.log(`Applied ${patch.name} Xcode 26 compatibility patch.`);
  } else {
    throw new Error(
      `${patch.name} source changed; review the Xcode 26 compatibility patch before building.`,
    );
  }
}
