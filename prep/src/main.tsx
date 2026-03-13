import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/light-theme-surfaces.css';
import './styles/light-theme-components.css';
import './styles/base.css';
import './styles/hub-projects.css';
import './styles/topbar-nav.css';
import './styles/dashboard.css';
import './styles/breakdown-panels.css';
import './styles/breakdown-script.css';
import './styles/breakdown-characters.css';
import './styles/form-panels.css';
import './styles/character-forms.css';
import './styles/spreadsheet.css';
import './styles/lookbook.css';
import './styles/bible.css';
import './styles/continuity.css';
import './styles/continuity-forms.css';
import './styles/budget.css';
import './styles/budget-forms.css';
import './styles/budget-tables.css';
import './styles/timesheet-layout.css';
import './styles/timesheet-crew.css';
import './styles/timesheet-weekly.css';
import './styles/timesheet-redesign.css';
import App from './App';

// Initialize theme before render
import { useThemeStore } from '@/stores/themeStore';
const { theme } = useThemeStore.getState();
if (theme === 'light') {
  document.documentElement.classList.add('light');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
