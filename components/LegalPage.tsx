import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Head from 'expo-router/head';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import mediumWeight from 'expo-symbols/androidWeights/medium';
import { CHROME_BOTTOM_RADIUS, CHROME_INSET, CHROME_RADIUS } from '@/components/HallChrome';
import { Theme } from '@/constants/Theme';

const BACK_SYMBOL = { ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' } as const;

/**
 * Shell for the static Privacy Policy and Support pages. Same chrome as
 * Settings, with a reading-width card so long lines stay comfortable on desktop.
 * The content is plain Text, so the static web export carries it as real HTML.
 */
export default function LegalPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
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
      <Head>
        <title>{`${title} · 5C Dining`}</title>
        <meta name="description" content={description} />
      </Head>
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
      <View style={styles.chrome}>
        <ScrollView style={styles.page} contentContainerStyle={styles.body}>
          <View style={styles.card}>{children}</View>
        </ScrollView>
      </View>
    </View>
  );
}

/** Headed section inside a legal page. */
export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.sectionBlock}>
      <Text role="heading" aria-level={2} style={styles.section}>
        {title}
      </Text>
      {children}
    </View>
  );
}

export function LegalParagraph({ children }: { children: ReactNode }) {
  return <Text style={styles.paragraph}>{children}</Text>;
}

export const legalLinkStyle = {
  color: Theme.black,
  fontWeight: '600',
  textDecorationLine: 'underline',
} as const;

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
  page: { flex: 1 },
  body: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 24,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 720,
    backgroundColor: Theme.white,
    borderRadius: 20,
    padding: 16,
    gap: 16,
  },
  sectionBlock: { gap: 6 },
  section: {
    fontSize: 17,
    fontWeight: '700',
    color: Theme.black,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 22,
    color: Theme.foodItem,
  },
});
