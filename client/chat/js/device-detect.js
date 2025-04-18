(() => {
  const currentUrl = window.location.href;
  const searchParams = new URLSearchParams(window.location.search);
  const forceCurrentView = searchParams.get('force_current_view');
  if (forceCurrentView === 'true') return;
  const isMobileUrl = currentUrl.includes('mobile.html');

  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);

  if (isMobile && !isMobileUrl) {
    window.location.href = 'mobile.html';
  } else if (!isMobile && isMobileUrl) {
    window.location.href = 'index.html';
  }
})();
