import React from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import NuovoArticoloPage from "./pages/NuovoArticoloPage.jsx";
import ArticoliPerFornitorePage from "./pages/ArticoliPerFornitorePage.jsx";
import ListaAcquistiPage from "./pages/ListaAcquistiPage.jsx";

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand__title">Gestionale Logistica Moda</div>
        </div>

        <nav className="nav">
          <NavLink className={({ isActive }) => (isActive ? "nav__link nav__link--active" : "nav__link")} to="/" title="Inserimento">
            <span className="nav__linkIcon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
            </span>
            <span className="nav__linkLabel">Inserimento</span>
          </NavLink>
          <NavLink className={({ isActive }) => (isActive ? "nav__link nav__link--active" : "nav__link")} to="/articoli" title="Lista articoli">
            <span className="nav__linkIcon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
            </span>
            <span className="nav__linkLabel">Lista articoli</span>
          </NavLink>
          <NavLink className={({ isActive }) => (isActive ? "nav__link nav__link--active" : "nav__link")} to="/lista-acquisti" title="Lista acquisti">
            <span className="nav__linkIcon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>
            </span>
            <span className="nav__linkLabel">Lista acquisti</span>
          </NavLink>
        </nav>
      </header>

      <main className="content">
        <Routes>
          <Route path="/" element={<NuovoArticoloPage />} />
          <Route path="/articoli" element={<ArticoliPerFornitorePage />} />
          <Route path="/lista-acquisti" element={<ListaAcquistiPage />} />
        </Routes>
      </main>
    </div>
  );
}

