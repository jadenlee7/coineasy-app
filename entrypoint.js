// Privy requires these globals before any SDK or application module evaluates.
import 'fast-text-encoding';
import 'react-native-get-random-values';
import '@ethersproject/shims';

import 'react-native-gesture-handler';
import 'react-native-reanimated';

import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
