let appInitialized = false;

function initApp() {
  if (appInitialized) {
    loadDevices();
    return;
  }
  appInitialized = true;

  initLogs();
  loadDevices();
}

// Boot
document.addEventListener('DOMContentLoaded', () => {
  initAuth();

  if (isLoggedIn()) {
    showAppScreen();
    initApp();
  } else {
    showAuthScreen();
  }
});
