// components/bannerAdNative.tsx
import { Platform } from 'react-native';
import type { FC } from 'react';

const AdFactory = Platform.select<() => FC>({
  ios: () => require('./bannerAd.native').BannerAdWrapper,
  android: () => require('./bannerAd.web').BannerAdWrapper, // Disabled for web
  web: () => require('./bannerAd.web').BannerAdWrapper, // Disabled for web
});

// Ensure it’s always defined and typed as a React.FC
export const BannerAdWrapper: FC = AdFactory ? AdFactory() : () => null;