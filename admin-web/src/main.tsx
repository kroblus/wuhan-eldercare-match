import ReactDOM from 'react-dom/client';
import { UIProvider, ConfirmationHost } from './ui';
import { brand } from './evergreen/tokens';
import './theme.css';
import App from './App';
for (const [name, value] of Object.entries(brand))
  document.documentElement.style.setProperty('--' + name, value);
ReactDOM.createRoot(document.getElementById('root')!).render(
  <UIProvider>
    <ConfirmationHost />
    <App />
  </UIProvider>,
);
