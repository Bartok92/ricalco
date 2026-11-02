import './styles.css';
import { installTouchGuards, requestPersistentStorage, fixStandaloneHeight } from './ios.js';
import { state, loadState, saveState } from './state.js';
import { registerServiceWorker } from './pwa.js';
import { renderHome } from './ui/home.js';
import { showGuide } from './ui/guide.js';
import { TraceScreen } from './trace/screen.js';

installTouchGuards();
fixStandaloneHeight();

const root = document.getElementById('app');
let current = null;
let updateReady = false;

const app = {
  go(name) {
    // Una nuova versione è pronta: la si carica tornando alla schermata iniziale.
    if (name === 'home' && updateReady) {
      current?.destroy();
      state.screen = 'home';
      saveState(true).finally(() => location.reload());
      return;
    }
    current?.destroy();
    state.screen = name;
    saveState();
    current = name === 'fixed' ? new TraceScreen(root, app) : renderHome(root, app);
  },
  showGuide(onDone) {
    if (!document.querySelector('.guide')) showGuide(document.body, onDone);
  },
};

async function boot() {
  requestPersistentStorage();
  await loadState();
  registerServiceWorker(() => {
    updateReady = true;
    if (state.screen === 'home' && !document.querySelector('.modal')) location.reload();
    else current?.showUpdateReady?.();
  });
  app.go(state.screen === 'fixed' ? 'fixed' : 'home');
  if (!state.onboarded) {
    app.showGuide(() => {
      state.onboarded = true;
      saveState();
    });
  }
}

boot();
