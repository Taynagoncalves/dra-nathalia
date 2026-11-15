import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { toast } from 'sonner';
import App from './App';
import { initPwa } from './lib/pwa';
import './index.css';

initPwa(() => toast.success('App instalado! Agora você pode abrir pelo ícone ⚖️ na tela inicial.'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
