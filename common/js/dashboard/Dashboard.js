// The Meow Apps dashboard, shared by every Meow plugin. Five tabs, one look (white cards):
// Meow Apps (verdict, to-dos, plugin cards), Health (the site in plain words), Errors (the PHP log),
// Settings (shared preferences) and About. Loads its data once here and hands it to the tabs.

const { useState, useEffect, useMemo, useCallback } = wp.element;
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { NekoPage, NekoHeader, NekoWrapper, NekoTab, NekoTabs, NekoBlock, NekoButton,
  NekoColumn, NekoSettings, NekoCheckboxGroup, NekoCheckbox, NekoMessage, nekoFetch } from '@neko-ui';

import { apiUrl, restUrl, pluginUrl, restNonce } from '@app/settings';
import { StyledSettingAction } from './Dashboard.styled';
import { readSite, recentProblems } from './facts';
import { Home } from './Home';
import { Health } from './Health';
import { Errors } from './Errors';
import { About } from './About';

if ( !apiUrl || !restUrl || !pluginUrl ) {
  console.error( '[@common/dashboard] apiUrl, restUrl and pluginUrl are mandatory.' );
}

const CommonApiUrl = `${restUrl}/meow-common/v1`;
const post = ( path, json ) => nekoFetch( `${CommonApiUrl}/${path}`, { method: 'POST', nonce: restNonce, ...( json && { json } ) } );

const Dashboard = () => {
  const queryClient = useQueryClient();
  const [fatalError, setFatalError] = useState( false );
  const [phpInfo, setPhpInfo] = useState( '' );
  const site = useMemo( readSite, [] );

  const { data: settings, error: queryError } = useQuery( {
    queryKey: ['all_settings'],
    queryFn: () => post( 'all_settings/' ).then( r => r.data ),
  } );

  const { data: installedPlugins } = useQuery( {
    queryKey: ['installed_plugins'],
    queryFn: () => post( 'installed_plugins/' ).then( r => r.data || {} ),
    staleTime: 60 * 1000,
  } );

  // Read once on arrival: the verdict on Home and the Errors rating both depend on it.
  const { data: logEntries, isError: logFailed } = useQuery( {
    queryKey: ['error_logs'],
    queryFn: () => post( 'error_logs' ).then( r => ( r.data || [] ).reverse() ),
    staleTime: 5 * 60 * 1000,
    retry: false,
  } );
  const problems = useMemo( () => ( logEntries ? recentProblems( logEntries ) : ( logFailed ? [] : undefined ) ),
    [logEntries, logFailed] );

  const { data: analysisStatus, refetch: refetchAnalysis } = useQuery( {
    queryKey: ['analysis_status'],
    queryFn: () => post( 'analysis_status/' ).then( r => r.data ),
    staleTime: 5 * 60 * 1000,
  } );

  const updateOptionMutation = useMutation( {
    mutationFn: ( { value, id } ) => post( 'update_option', { name: id, value } ),
    onSuccess: () => queryClient.invalidateQueries( ['all_settings'] ),
  } );

  useEffect( () => {
    if ( queryError && !fatalError ) {
      setFatalError( true );
      console.error( 'Error from useQuery', queryError.message );
    }
  }, [queryError] );

  useEffect( () => {
    const info = document.getElementById( 'meow-common-phpinfo' );
    if ( info ) {
      setPhpInfo( info.innerHTML );
    }
  }, [] );

  const [forgetting, setForgetting] = useState( false );
  const forgetAnalysis = useCallback( async () => {
    setForgetting( true );
    try {
      await post( 'analysis_forget/' );
      await refetchAnalysis();
    }
    finally {
      setForgetting( false );
    }
  }, [refetchAnalysis] );

  const handleUpdateOption = ( value, id ) => updateOptionMutation.mutate( { value, id } );
  const hideMeowApps = settings?.meowapps_hide_meowapps;
  const forceSslVerify = settings?.force_sslverify;

  return (
    <NekoPage showRestError={fatalError}>
      <NekoHeader title="The Dashboard" />
      <NekoWrapper>
        <NekoColumn full>
          <NekoTabs keepTabOnReload={true}>
            <NekoTab title="Meow Apps">
              <Home installedPlugins={installedPlugins} site={site} problems={problems} />
            </NekoTab>
            <NekoTab title="Health">
              <Health site={site} problems={problems} phpInfo={phpInfo}
                analysisStatus={analysisStatus} onAnalysisDone={refetchAnalysis} />
            </NekoTab>
            <NekoTab title="Errors">
              <Errors problems={problems} entries={logEntries} failed={logFailed} />
            </NekoTab>
            <NekoTab title="Settings">
              <NekoBlock title="Shared Preferences" className="primary"
                subtitle="Settings every Meow Apps plugin on this site shares, and the data the dashboard keeps about it.">
                {hideMeowApps && (
                  <NekoMessage variant="warning">
                    The Meow Apps menu is hidden right now, so every plugin screen behind it is only reachable by direct link.
                  </NekoMessage>
                )}
                {/* The AI review keeps its answer so it survives a reload; someone has to be able to remove it. */}
                {( analysisStatus?.last || analysisStatus?.consented ) && (
                  <NekoSettings title="Site analysis">
                    <StyledSettingAction>
                      <NekoButton className="danger" onClick={forgetAnalysis} disabled={forgetting} isBusy={forgetting}>
                        Forget the stored analysis
                      </NekoButton>
                      <span className="action-note">
                        Removes the saved answer and this site's agreement to send data for it.
                        {analysisStatus?.last?.ranAt && ` Last run ${analysisStatus.last.ranAt}.`}
                      </span>
                    </StyledSettingAction>
                  </NekoSettings>
                )}
                <NekoSettings title="Main Menu">
                  <NekoCheckboxGroup max="1">
                    <NekoCheckbox name="meowapps_hide_meowapps" variant="danger"
                      label="Hide the Meow Apps menu (not recommended)"
                      description={'Removes the Meow Apps menu on the left, and every plugin screen inside it. '
                        + 'To bring it back, tick "Show Meow Apps Menu" in Settings → General.'}
                      value="1" disabled={updateOptionMutation.isPending}
                      checked={hideMeowApps} onChange={handleUpdateOption} />
                  </NekoCheckboxGroup>
                </NekoSettings>
                <NekoSettings title="SSL Verify">
                  <NekoCheckboxGroup max="1">
                    <NekoCheckbox name="force_sslverify" variant="danger"
                      label="Force SSL verification (not recommended)"
                      description={'Requires a valid SSL certificate when checking a licence or fetching an update. '
                        + 'Hosts with an out-of-date certificate bundle will fail both, which is why it is off by default.'}
                      value="1" disabled={updateOptionMutation.isPending}
                      checked={forceSslVerify} onChange={handleUpdateOption} />
                  </NekoCheckboxGroup>
                </NekoSettings>
              </NekoBlock>
            </NekoTab>
            <NekoTab title="About">
              <About />
            </NekoTab>
          </NekoTabs>
        </NekoColumn>
      </NekoWrapper>
    </NekoPage>
  );
};

export { Dashboard };
