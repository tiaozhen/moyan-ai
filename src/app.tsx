import { Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import NotFoundPage from '@/pages/NotFoundPage/NotFoundPage';
import CategoryResearchPage from '@/pages/CategoryResearchPage/CategoryResearchPage';
import OutlinePage from '@/pages/OutlinePage/OutlinePage';
import OutlineExpansionPage from '@/pages/OutlineExpansionPage/OutlineExpansionPage';
import NovelGeneratorPage from '@/pages/NovelGeneratorPage/NovelGeneratorPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<CategoryResearchPage />} />
        <Route path="outline" element={<OutlinePage />} />
        <Route path="expansion" element={<OutlineExpansionPage />} />
        <Route path="novel" element={<NovelGeneratorPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
