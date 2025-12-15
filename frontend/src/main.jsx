import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
// 1. Import Router components
import { BrowserRouter, Routes, Route } from "react-router-dom";

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* 2. Setup Routing */}
    <BrowserRouter>
      <Routes>
        {/* Home Page */}
        <Route path="/" element={<App />} />
        
        {/* Shared Code Page (:id is a variable) */}
        <Route path="/share/:id" element={<App />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)