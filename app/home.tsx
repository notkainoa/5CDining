import { Redirect } from 'expo-router';

/** `/home` is not a screen — send it to the root app URL. */
export default function Home() {
  return <Redirect href="/" />;
}
