import * as React from 'react';

const fallbackVersion =
  typeof React.version === 'string' && React.version.trim().length > 0
    ? React.version
    : '0.0.0';

declare global {
  interface Window {
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: {
      inject?: (renderer: { version?: string }) => unknown;
    };
  }
}

if (typeof window !== 'undefined') {
  const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (hook?.inject) {
    const originalInject = hook.inject.bind(hook);
    hook.inject = (renderer) => {
      if (
        !renderer.version ||
        typeof renderer.version !== 'string' ||
        renderer.version.trim().length === 0
      ) {
        renderer.version = fallbackVersion;
      }
      return originalInject(renderer);
    };
  }
}


