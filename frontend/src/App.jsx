import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import HomePage from "./pages/HomePage";
import MatchPage from "./pages/MatchPage";
import Topbar from "./components/Topbar";
import MobileHeader from "./components/MobileHeader";
import ChatFab from "./components/ChatFab";       // 💬 buton
import ChatModal from "./components/ChatModal";   // 💬 tam ekran modal

export default function App() {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Mobil üst header (sabit) */}
      <MobileHeader />

      {/* Masaüstü topbar + mobil alt bar */}
      <Topbar />

      {/* 💬 Mobil sohbet butonu ve modal */}
      <ChatFab />
      <ChatModal />

      {/* İçerik: mobilde üst/alt sabit barlara yer aç */}
      <div className="px-1 pt-[64px] pb-[84px] sm:pt-0 sm:pb-0">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/match/:id" element={<MatchPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}