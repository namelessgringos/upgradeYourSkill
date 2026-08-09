import { Redirect } from 'expo-router';

/**
 * The Train tab hands off immediately to the /train stack, which mounts its
 * own SessionProvider — training session state is scoped to that flow, not
 * the tab bar.
 */
export default function TrainTab() {
  return <Redirect href="/train/setup" />;
}
