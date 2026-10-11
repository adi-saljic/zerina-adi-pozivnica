import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
// Wedding fonts, self-hosted (no Google requests, CSP stays 'self').
// Each file covers all subsets with unicode-range, so phones only download
// latin + latin-ext (č ć đ š ž).
import '@fontsource/pinyon-script/400.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import './styles/global.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root missing in index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
