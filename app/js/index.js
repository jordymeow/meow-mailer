const { render } = wp.element;

import { NekoUI } from '@neko-ui';
import MainScreen from '@app/components/MainScreen';
import { CoreContextProvider } from '@app/contexts/core';

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
});
