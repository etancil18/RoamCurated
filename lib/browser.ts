export const inBrowser = typeof window !== 'undefined';

export const getHref = () =>
  inBrowser ? window.location.href : '';

export const getOrigin = () =>
  inBrowser ? window.location.origin : '';
