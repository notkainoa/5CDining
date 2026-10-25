import { Link } from 'expo-router';
import { ExternalLink } from '@/components/ExternalLink';
import LegalPage, { LegalParagraph, LegalSection, legalLinkStyle } from '@/components/LegalPage';

export default function SupportScreen() {
  return (
    <LegalPage
      title="Support"
      description="Get help with 5C Dining, the Claremont Colleges dining menu app."
    >
      <LegalParagraph>
        5C Dining shows today&apos;s menus for the Claremont Colleges dining halls, with dietary
        highlights and ingredient filters. It is an independent student project and is not
        affiliated with or endorsed by the Claremont Colleges or their dining services.
      </LegalParagraph>

      <LegalSection title="Report a problem">
        <LegalParagraph>
          Email{' '}
          <Link href="mailto:k@kainoa.me" style={legalLinkStyle}>
            k@kainoa.me
          </Link>{' '}
          or open an issue on{' '}
          <ExternalLink href="https://github.com/notkainoa/5CDining/issues" style={legalLinkStyle}>
            GitHub
          </ExternalLink>
          . Tell us what you were doing, which dining hall and date, and your device if you can.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Menu accuracy">
        <LegalParagraph>
          Menus come from the colleges&apos; public menu pages and can change at any time. If
          something looks wrong, or you have a serious allergy, check with the dining hall staff.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Privacy">
        <LegalParagraph>
          Read the{' '}
          <Link href="/privacy" style={legalLinkStyle}>
            privacy policy
          </Link>
          .
        </LegalParagraph>
      </LegalSection>
    </LegalPage>
  );
}
