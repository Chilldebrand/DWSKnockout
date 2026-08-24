import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import PickPage from './pages/PickPage.jsx'
import { AuthProvider } from './context/AuthContext.jsx'

function Placeholder({ title, note }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-field-900 p-8">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-gray-400">{note}</p>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Placeholder title="Dashboard" note="Week overview, your pick status, countdown to kickoff." />} />
          <Route path="/pick" element={<PickPage />} />
          <Route path="/standings" element={<Placeholder title="Standings" note="Pick records, streaks, alive/eliminated status." />} />
          <Route path="/schedule" element={<Placeholder title="Schedule" note="Full season schedule by week." />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<Placeholder title="Admin" note="Results entry and league management." />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
