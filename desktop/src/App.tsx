import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';
// Pages use a mix of default and named exports
import ProjectHub from '@/pages/ProjectHub';
import Dashboard from '@/pages/Dashboard';
import Breakdown from '@/pages/Breakdown';
import Characters from '@/pages/Characters';
import Continuity from '@/pages/Continuity';
import Budget from '@/pages/Budget';
import Timesheet from '@/pages/Timesheet';
import Settings from '@/pages/Settings';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Project Hub — no sidebar */}
        <Route path="/" element={<ProjectHub />} />

        {/* Project routes — sidebar layout */}
        <Route element={<AppShell />}>
          <Route path="/project/:projectId" element={<Dashboard />} />
          <Route path="/project/:projectId/breakdown" element={<Breakdown />} />
          <Route path="/project/:projectId/characters" element={<Characters />} />
          <Route path="/project/:projectId/continuity" element={<Continuity />} />
          <Route path="/project/:projectId/budget" element={<Budget />} />
          <Route path="/project/:projectId/timesheet" element={<Timesheet />} />
        </Route>

        <Route path="/settings" element={<Settings />} />
      </Routes>
    </BrowserRouter>
  );
}
