import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AdminImpersonationBar } from './components/AdminImpersonationBar'
import { RequireAuth } from './components/RequireAuth'
import { ScrollToTopOnRoute } from './components/ScrollToTopOnRoute'
import { AuthProvider } from './contexts/AuthProvider'
import { HomeList } from './pages/HomeList'
import { AlmuerzoForm } from './pages/AlmuerzoForm'
import { AlmuerzoDetail } from './pages/AlmuerzoDetail'
import { LoginPage } from './pages/LoginPage'
import './App.css'

/**
 * Raíz de la app: rutas públicas (login) y rutas protegidas (CRUD almuerzos).
 */
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTopOnRoute />
        <AdminImpersonationBar />
        <div className="app-shell">
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireAuth />}>
              <Route path="/" element={<HomeList />} />
              <Route path="/nuevo" element={<AlmuerzoForm mode="create" />} />
              <Route path="/almuerzo/:id" element={<AlmuerzoDetail />} />
              <Route path="/almuerzo/:id/editar" element={<AlmuerzoForm mode="edit" />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
