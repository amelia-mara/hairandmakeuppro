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
import './styles/character-design.css';
import './styles/budget.css';
import './styles/budget-forms.css';
import './styles/budget-tables.css';
import './styles/timesheet-layout.css';
import './styles/timesheet-crew.css';
import './styles/timesheet-weekly.css';
import './styles/timesheet-redesign.css';
import './styles/schedule.css';
import './styles/call-sheets.css';
import './styles/team.css';
import './styles/auth.css';
import './styles/scriptie-chat.css';
import App from './App';

// Initialize theme before render — triggers applyTheme which sets both class and data-theme
import { useThemeStore } from '@/stores/themeStore';
const { theme, setTheme } = useThemeStore.getState();
setTheme(theme);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
