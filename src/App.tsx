import { lazy, Suspense } from 'react';
import { InvitationApp } from './InvitationApp';
import { LoadingScreen } from './components/LoadingScreen';
import { getCodeFromLocation } from './lib/invitationUrl';

// Separate chunk: guests never download the admin code.
const AdminPage = lazy(() => import('./admin/AdminPage'));

export function App() {
  if (/^\/admin\/?$/.test(window.location.pathname)) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <AdminPage />
      </Suspense>
    );
  }
  return <InvitationApp code={getCodeFromLocation(window.location)} />;
}
