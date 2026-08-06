// React & Vendor Libs
const { useState, useEffect, useRef, useCallback } = wp.element;

// NekoUI
import { NekoButton, NekoGauge } from '@neko-ui';
import { nekoFetch } from '@neko-ui';

// From Main Plugin
import { restUrl, restNonce } from '@app/settings';

// Common
import { StyledSpeedTest } from './Dashboard.styled';
const CommonApiUrl = `${restUrl}/meow-common/v1`;

// The test used to hammer the server once a second forever, until you noticed
// the Stop button. Ten samples is enough for a stable average and gives the run
// an end, which matters on a live site — this ships in every Meow plugin.
const SAMPLES = 10;
const GAP_MS = 400;

const average = ( list ) => ( list.length
  ? Math.round( list.reduce( ( a, b ) => a + b, 0 ) / list.length )
  : 0 );

const VERDICT_LABEL = { fast: 'Fast', fair: 'Could be better', slow: 'Slow' };

// `onResult` reports upward every time this card's state settles. Two things
// need it: the compact strip shown when Speed is collapsed — which must survive
// the card being unmounted — and the analysis, whose speed step is these very
// numbers rather than a second set of requests.
const SpeedTester = ( { request, title, hint, max, good, ok, startSignal, onResult } ) => {
  const [running, setRunning] = useState( false );
  const [results, setResults] = useState( [] );
  // A request that never came back used to put the card back exactly as it
  // started — "—", "Not measured", "Start" — so a broken endpoint looked
  // identical to a button that did nothing.
  const [failed, setFailed] = useState( false );

  // Every start takes a new generation. A reply belonging to a previous run —
  // because you pressed Stop, or Start again — sees the number has moved on and
  // retires quietly. Before this, a request in flight when you pressed Stop
  // still landed and added a sample, and Start-Stop-Start left two loops
  // running at once, both writing to the same average.
  const genRef = useRef( 0 );
  const timerRef = useRef( null );

  const stop = useCallback( () => {
    genRef.current += 1;
    if ( timerRef.current ) clearTimeout( timerRef.current );
    timerRef.current = null;
    setRunning( false );
  }, [] );

  const start = useCallback( () => {
    genRef.current += 1;
    // "Start Speed Test" can be pressed while a card is already running, which
    // reaches here without going through stop(). The generation bump retires the
    // old chain, but its pending timer would still fire once first and put a
    // wasted request on the server before noticing it had been retired.
    if ( timerRef.current ) clearTimeout( timerRef.current );
    timerRef.current = null;
    const gen = genRef.current;
    const samples = [];
    setResults( [] );
    setFailed( false );
    setRunning( true );

    const tick = async () => {
      const started = performance.now();
      try {
        await nekoFetch( `${CommonApiUrl}/${request}`, { method: 'POST', nonce: restNonce } );
      }
      catch ( e ) {
        // An endpoint that errors used to leave the gauge running forever.
        if ( gen === genRef.current ) {
          setFailed( true );
          setRunning( false );
        }
        return;
      }
      if ( gen !== genRef.current ) return;
      samples.push( Math.round( performance.now() - started ) );
      setResults( [...samples] );
      if ( samples.length >= SAMPLES ) {
        setRunning( false );
        return;
      }
      timerRef.current = setTimeout( tick, GAP_MS );
    };
    tick();
  }, [request] );

  // "Start Speed Test" bumps a counter the three cards share. It starts at 0, so
  // they stay idle until you actually ask.
  useEffect( () => {
    if ( startSignal ) start();
  }, [startSignal, start] );

  useEffect( () => () => {
    genRef.current += 1;
    if ( timerRef.current ) clearTimeout( timerRef.current );
  }, [] );

  const avg = average( results );
  const done = results.length > 0;
  // A millisecond count means nothing on its own. The thresholds used to live in
  // a paragraph above three gauges that never referred back to it.
  const verdict = !done ? null : ( avg <= good ? 'fast' : ( avg <= ok ? 'fair' : 'slow' ) );

  // Reported after the render that produced it, not during — calling a parent's
  // setState inside a render is what React warns about, and this fires on every
  // sample while a run is in progress.
  useEffect( () => {
    if ( !onResult ) return;
    onResult( request, { title, avg, samples: results.length, verdict, failed, running } );
  }, [onResult, request, title, avg, results.length, verdict, failed, running] );

  return (
    <StyledSpeedTest className={running ? 'is-running' : ''}>
      <h3>{title}</h3>

      <NekoGauge width={168} value={avg} max={max}>
        <span className="gauge-value">{done ? avg : '—'}{done && <i>ms</i>}</span>
        <span className="gauge-sub">
          {running ? `${results.length} of ${SAMPLES}`
            : ( failed
              // Failing on the very first request is the common case; "stopped
              // after 0" reads like a bug report about the counter.
              ? ( results.length ? `Stopped after ${results.length}` : 'No response' )
              : ( done ? `${results.length} requests` : 'Not measured' ) )}
        </span>
      </NekoGauge>

      <span className={`verdict${failed ? ' is-failed' : ( verdict ? ` is-${verdict}` : '' )}`}>
        {failed ? 'Request failed'
          : ( verdict ? VERDICT_LABEL[verdict] : `Fast is under ${good} ms` )}
      </span>

      <p className="hint">
        {failed
          ? 'Your site did not answer. A security plugin or a server rule blocking the REST API is the usual cause.'
          : hint}
      </p>

      <NekoButton className={running ? 'danger' : 'primary'}
        onClick={running ? stop : start}>
        {running ? 'Stop' : ( failed ? 'Try Again' : ( done ? 'Start Again' : 'Start' ) )}
      </NekoButton>
    </StyledSpeedTest>
  );
};

export { SpeedTester };
