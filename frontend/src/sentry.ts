import * as Sentry from '@sentry/browser';

export const getSentry = (): typeof Sentry | undefined => {
  // Don't clutter up sentry logs with debug stuff
  if (window.location.href.includes('http://localhost')) {
    return undefined;
  }
  return Sentry;
};

export const initSentry = () => {
  // Don't clutter up sentry logs with debug stuff
  if (window.location.href.includes('http://localhost')) {
    return;
  }

  Sentry.init({
    dsn: 'https://3b73decea1fd4881984f19c6228ad86f@sentry.ameo.design/18',
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 1.0,
  });
};

export const logError = (msg: string, err?: any) => {
  console.error(msg, err);
  const sentry = getSentry();
  if (sentry) {
    if (err) {
      sentry.captureException(err);
    } else {
      sentry.captureMessage(msg, 'error');
    }
  }
};
