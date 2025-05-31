// Main Sentry service exports
export { SentryAutoInstrumentation } from './autoInstrumentation';
export { createExpoRouterNavigationIntegration, initializeSentry } from './core';
export { SentryDataCollection } from './dataCollection';
export { SentryDebug } from './debug';
export { SentryDistributedTracing } from './distributedTracing';
export { SentryInsights } from './insights';
export { SentryLogger } from './logger';
export { SentryPerformance } from './performance';
export { SentryReactProfiler } from './reactProfiler';
export { SentryReleaseHealth } from './releaseHealth';
export { SentryTesting } from './testing';

// Re-export core Sentry functions
import * as Sentry from '@sentry/react-native';
export const { captureException, captureMessage, addBreadcrumb, setUser, setContext, setTag } =
  Sentry;
export default Sentry;
