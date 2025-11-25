// main.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import CampaignJsonEditor from "./components/CampaignJsonEditor.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Khi vào "/", tự chuyển sang /editor */}
        <Route path="/" element={<Navigate to="/editor" />} />

        {/* Trang Editor */}
        <Route path="/editor" element={<CampaignJsonEditor />} />

        {/* Nếu user vào sai URL → cũng đưa về editor */}
        <Route path="*" element={<Navigate to="/editor" />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
