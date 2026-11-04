import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import '@fontsource-variable/inter'
import '@fontsource-variable/bricolage-grotesque'
import './styles.css'
import App from './App'
import { Activity, Files, Links, NotFound, Overview, Search, Settings } from './pages'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route index element={<Overview />} />
          <Route path="arquivos" element={<Files />} />
          <Route path="links" element={<Links />} />
          <Route path="atividade" element={<Activity />} />
          <Route path="configuracoes" element={<Settings />} />
          <Route path="buscar" element={<Search />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
