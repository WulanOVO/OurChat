(() => {
  function isMobileDevice() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;

    if (/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent)) {
      return true;
    }

    if (window.innerWidth < 768) {
      return true;
    }

    return false;
  }

  function getCurrentPage() {
    const path = window.location.pathname;
    const pageName = path.split('/').pop();
    return pageName || 'index.html';
  }

  function redirectToProperPage() {
    const currentPage = getCurrentPage();
    const isMobile = isMobileDevice();

    if (currentPage === 'index.html' || currentPage === '') {
      if (isMobile) {
        window.location.href = '/chat/mobile.html';
      }
    }

    else if (currentPage === 'mobile.html' && !isMobile) {
      window.location.href = '/chat/index.html';
    }
  }

  window.addEventListener('DOMContentLoaded', redirectToProperPage);
})();