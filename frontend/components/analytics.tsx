import { Platform } from 'react-native';

let logEvent: (event: string, params?: any) => void;

if (Platform.OS === 'web') {
  logEvent = require('./analytics.web').logEvent;
} else {
  logEvent = require('./analytics.native').logEvent;
}

export { logEvent };