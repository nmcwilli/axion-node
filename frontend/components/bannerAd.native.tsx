import React, { useEffect, useState } from 'react';
import { Platform, View, StyleSheet, Dimensions } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

export const BannerAdWrapper: React.FC = () => {
  const [BannerAdComponent, setBannerAdComponent] = useState<React.FC | null>(null);
  const IS_TEST = __DEV__ || process.env.EXPO_PUBLIC_PREVIEW === 'true';

  useEffect(() => {
    import('react-native-google-mobile-ads')
      .then(({ BannerAd, BannerAdSize, TestIds }) => {
        const adUnitID = IS_TEST
          ? TestIds.BANNER
          : Platform.select({
              ios: 'ca-app-pub-8674415914455935/5692919576',
              android: 'ca-app-pub-8674415914455935/2497562986',
            }) ?? TestIds.BANNER;

        let selectedSize = BannerAdSize.BANNER;

        if (screenWidth >= 728) {
          selectedSize = BannerAdSize.LEADERBOARD;
        } else if (screenWidth >= 360) {
          selectedSize = BannerAdSize.LARGE_BANNER;
        }

        const Component: React.FC = () => (
          <BannerAd
            unitId={adUnitID}
            size={selectedSize}
            requestOptions={{ requestNonPersonalizedAdsOnly: true }}
            onAdFailedToLoad={(err: Error) => console.error('Ad load failed:', err)}
          />
        );

        setBannerAdComponent(() => Component);
      })
      .catch(err => console.error('Failed to load mobile ads:', err));
  }, []);

  return BannerAdComponent ? (
    <View style={styles.adContainer}>
      <BannerAdComponent />
    </View>
  ) : null;
};

const styles = StyleSheet.create({
  adContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
});