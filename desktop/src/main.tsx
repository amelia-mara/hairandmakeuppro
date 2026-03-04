import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { ProjectHub } from './pages/ProjectHub'
import './styles/theme.css'

const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <ProjectHub />,
    },
    {
      path: '/project/:projectId',
      element: <div>Dashboard — coming soon</div>,
    },
    {
      path: '/project/:projectId/breakdown',
      element: <div>Breakdown — coming soon</div>,
    },
    {
      path: '/project/:projectId/characters',
      element: <div>Characters — coming soon</div>,
    },
    {
      path: '/project/:projectId/continuity',
      element: <div>Continuity — coming soon</div>,
    },
    {
      path: '/project/:projectId/budget',
      element: <div>Budget — coming soon</div>,
    },
    {
      path: '/project/:projectId/timesheet',
      element: <div>Timesheet — coming soon</div>,
    },
    {
      path: '/settings',
      element: <div>Settings — coming soon</div>,
    },
  ],
  { basename: '/prep' }
)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)
