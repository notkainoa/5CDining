import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import mediumWeight from 'expo-symbols/androidWeights/medium';
import { CHROME_BOTTOM_RADIUS, CHROME_INSET, CHROME_RADIUS } from '@/components/HallChrome';
import { Theme } from '@/constants/Theme';

const BACK_SYMBOL = { ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' } as const;

/**
 * Black shell with a back button and large title over a rounded dark chrome
 * card. Shared by Settings and the pages pushed from it; children fill the card.
 */
export default function ScreenShell({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  return (
    <View
      style={[
        styles.shell,
        {
          paddingTop: Math.max(insets.top, CHROME_INSET),
          paddingLeft: Math.max(insets.left, CHROME_INSET),
          paddingRight: Math.max(insets.right, CHROME_INSET),
          paddingBottom: Math.max((insets.bottom * 6) / 10, CHROME_INSET),
        },
      ]}
    >
      <StatusBar style="light" />
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={4}
          onPress={goBack}
          style={({ pressed }) => [styles.backBtn, pressed && styles.backPressed]}
        >
          <SymbolView
            name={BACK_SYMBOL}
            tintColor={Theme.white}
            size={22}
            weight={{ ios: 'medium', android: mediumWeight }}
          />
        </Pressable>
        <Text role="heading" aria-level={1} style={styles.title}>
          {title}
        </Text>
      </View>
      <View style={styles.chrome}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: Theme.black,
  },
  chrome: {
    flex: 1,
    backgroundColor: Theme.darkerGray,
    borderTopLeftRadius: CHROME_RADIUS,
    borderTopRightRadius: CHROME_RADIUS,
    borderBottomLeftRadius: CHROME_BOTTOM_RADIUS,
    borderBottomRightRadius: CHROME_BOTTOM_RADIUS,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
    gap: 8,
  },
  backBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Theme.darkGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPressed: {
    transform: [{ scale: 0.97 }],
  },
  title: {
    color: Theme.white,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    flex: 1,
  },
});
