import { render } from 'solid-js/web';
import App from './App';
import { store } from './store';

// The one permitted `Window` augmentation, per 02-01-coding-standard.md: the test
// affordance is declared rather than reached through a cast.
declare global {
  interface Window {
    __store?: typeof store;
  }
}

window.__store = store;

render(() => <App />, document.getElementById('root')!);
