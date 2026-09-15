import { render } from 'solid-js/web';
import App from './App';
import { store } from './store';

(window as any).__store = store;

render(() => <App />, document.getElementById('root')!);
