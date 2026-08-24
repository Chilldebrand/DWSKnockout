import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import PickPage from './pages/PickPage.jsx'
import Standings from './pages/Standings.jsx'
import Dashboard from './pages/Dashboard.jsx'
import AdminPage from './pages/AdminPage.jsx'
import SchedulePage from './pages/SchedulePage.jsx'
import { AuthProvider } from './context/AuthContext.jsx'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="/pick" element={<PickPage />} />
          <Route path="/standings" element={<Standings />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
