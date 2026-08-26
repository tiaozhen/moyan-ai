import { Routes, Route } from "react-router-dom";
import { Welcome } from "@lark-apaas/client-toolkit-lite";
import { Layout } from "@/components/Layout";
import NotFoundPage from "@/pages/NotFoundPage/NotFoundPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Welcome />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
