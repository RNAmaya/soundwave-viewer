import { Route, Routes } from "react-router-dom";
import { PlayerPage } from "./pages/PlayerPage";
import { NotFoundPage } from "./pages/NotFoundPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PlayerPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
