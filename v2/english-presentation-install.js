/* Native English presentation installs after the last Magic learning wrapper. */
(() => {
  'use strict';
  if (document.documentElement.dataset.flowDesign !== 'magic') return;
  window.FlowEnglishPresentation?.installNative({
    getState: typeof enState === 'function' ? enState : undefined,
    icon: typeof window.icon === 'function' ? window.icon : undefined
  });
})();
