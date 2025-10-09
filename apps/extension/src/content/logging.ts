interface BreadcrumbOptions {
  category: string;
  message: string;
  data?: Record<string, unknown>;
}

export function logBreadcrumb({ category, message, data }: BreadcrumbOptions): void {
  if (typeof window !== 'undefined' && (window as unknown as { Sentry?: unknown }).Sentry) {
    const Sentry = (window as unknown as { Sentry: { addBreadcrumb?: (crumb: unknown) => void } }).Sentry;
    Sentry.addBreadcrumb?.({ category, message, data });
  } else {
    console.debug(`[WebVoca][${category}]`, message, data ?? '');
  }
}

export function logError(error: unknown, context?: Record<string, unknown>): void {
  if (error instanceof Error) {
    console.error('[WebVoca]', error.message, context ?? {}, error);
  } else {
    console.error('[WebVoca]', error, context ?? {});
  }
}
