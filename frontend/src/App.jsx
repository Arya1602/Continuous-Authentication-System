import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import HomePage    from './pages/HomePage'
import EnrollPage  from './pages/EnrollPage'
import SessionPage from './pages/SessionPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"        element={<HomePage />} />
        <Route path="/enroll"  element={<EnrollPage />} />
        <Route path="/session" element={<SessionPage />} />
        <Route path="*"        element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
