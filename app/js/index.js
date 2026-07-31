const { render } = wp.element;

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { NekoUI } from '@neko-ui';
import MainScreen from '@app/components/MainScreen';
import { CoreContextProvider } from '@app/contexts/core';
import { Dashboard } from '@common/dashboard/Dashboard';

document.addEventListener('DOMContentLoaded', function () {
  const container = document.getElementById('mwmail-admin-settings');
  if (container) {
    render(
      <NekoUI>
        <CoreContextProvider>
          <MainScreen />
        </CoreContextProvider>
      </NekoUI>,
      container
    );
  }

  // The Meow Apps dashboard is a shared page: the common library only prints an
  // empty container, and whichever Meow plugin is active fills it in. Meow Mailer
  // is often someone's first (or only) Meow plugin, so it has to render it too,
  // otherwise that page is simply blank.
  const dashboard = document.getElementById('meow-common-dashboard');
  if (dashboard) {
    render(
      <NekoUI>
        <QueryClientProvider client={new QueryClient()}>
          <Dashboard />
        </QueryClientProvider>
      </NekoUI>,
      dashboard
    );
  }
});
