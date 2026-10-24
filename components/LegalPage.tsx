import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Head from 'expo-router/head';
import ScreenShell from '@/components/ScreenShell';
import { Theme } from '@/constants/Theme';

/**
 * Static Privacy Policy and Support pages. Same shell as Settings, with a
 * reading-width card so long lines stay comfortable on desktop. The content is
 * plain Text, so the static web export carries it as real HTML.
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
  return (
    <ScreenShell title={title}>
      <Head>
        <title>{`${title} · 5C Dining`}</title>
        <meta name="description" content={description} />
      </Head>
      <ScrollView style={styles.page} contentContainerStyle={styles.body}>
        <View style={styles.card}>{children}</View>
      </ScrollView>
    </ScreenShell>
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
