import { Link } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { ExternalLink } from '@/components/ExternalLink';
import LegalPage, { LegalParagraph, LegalSection, legalLinkStyle } from '@/components/LegalPage';
import { Theme } from '@/constants/Theme';

const EFFECTIVE = 'October 23, 2026';

export default function PrivacyScreen() {
  return (
    <LegalPage
      title="Privacy Policy"
      description="5C Dining has no accounts, analytics, or ads. Preferences stay on your device."
    >
      <Text style={styles.effective}>Effective {EFFECTIVE}</Text>

      <LegalSection title="What we collect">
        <LegalParagraph>
          Nothing that identifies you. 5C Dining has no accounts and no sign-in. It has no
          analytics, no advertising, and no third-party SDKs that collect data. The only information
          that leaves your device is the standard request information any web server sees when the
          app loads menus (your IP address and user agent), described under Network requests below.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Data stored on your device">
        <LegalParagraph>
          Your preferences are saved on your device and nowhere else: dining hall order, diet
          highlights, ingredients you avoid, display options, and favorite dishes. The app stores
          them in the app&apos;s local storage (your browser&apos;s local storage on the web
          version). Deleting the app, or clearing site data on the web, removes it all.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Network requests">
        <LegalParagraph>
          To show menus, the app requests them from our own menu API at
          five-c-menu-api.kainoanewton.workers.dev, which runs on Cloudflare. A request says which
          dining hall and date you&apos;re viewing. Like any web server, the API receives the
          standard request information: your IP address and user agent. It does not store that
          beyond ordinary operational logs, and it is not used to identify or track you. The web
          version of the app is also served through Cloudflare. Cloudflare processes these requests
          as our hosting provider under its{' '}
          <ExternalLink href="https://www.cloudflare.com/privacypolicy/" style={legalLinkStyle}>
            privacy policy
          </ExternalLink>
          .
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Third parties">
        <LegalParagraph>
          Cloudflare hosts the API and the website. Menu content comes from the dining
          services&apos; public menu pages. No one else receives data from the app. 5C Dining is an
          independent student project and is not affiliated with or endorsed by the Claremont
          Colleges or their dining services.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Children">
        <LegalParagraph>
          The app collects no personal information from anyone, including children under 13.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Changes">
        <LegalParagraph>
          If this policy changes, the new version will be posted here with an updated effective
          date.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Contact">
        <LegalParagraph>
          Kainoa Newton,{' '}
          <Link href="mailto:k@kainoa.me" style={legalLinkStyle}>
            k@kainoa.me
          </Link>
          . The source code is at{' '}
          <ExternalLink href="https://github.com/notkainoa/5CDining" style={legalLinkStyle}>
            github.com/notkainoa/5CDining
          </ExternalLink>
          .
        </LegalParagraph>
      </LegalSection>
    </LegalPage>
  );
}

const styles = StyleSheet.create({
  effective: { fontSize: 13, color: Theme.foodMuted },
});
