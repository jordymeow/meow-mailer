// Every Meow plugin ships its own copy of this dashboard and renders it into the same
// #meow-common-dashboard element, so the last plugin to load used to win, even with an older copy.
// Plugins now call mountCommonDashboard(render): each one registers its version, and only the newest
// copy renders, one task later, after every plugin's DOM-ready code has run. Older plugins that
// still render directly are simply drawn over.
const DASHBOARD_VERSION = 20261026;

const mountCommonDashboard = ( render ) => {
  if ( ( window.meowCommonDashboardVersion || 0 ) >= DASHBOARD_VERSION ) {
    return;
  }
  window.meowCommonDashboardVersion = DASHBOARD_VERSION;
  setTimeout( () => {
    if ( window.meowCommonDashboardVersion === DASHBOARD_VERSION ) {
      render();
    }
  }, 0 );
};

export { mountCommonDashboard, DASHBOARD_VERSION };
