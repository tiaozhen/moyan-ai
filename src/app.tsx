import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import NotFoundPage from '@/pages/NotFoundPage/NotFoundPage';
import CategoryResearchPage from '@/pages/CategoryResearchPage/CategoryResearchPage';
import OutlinePage from '@/pages/OutlinePage/OutlinePage';
import BookListPage from '@/pages/BookListPage/BookListPage';
import BookDetailPage from '@/pages/BookDetailPage/BookDetailPage';
import BookOutlineTab from '@/pages/BookDetailPage/BookOutlineTab';
import BookEditorTab from '@/pages/BookDetailPage/BookEditorTab';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<CategoryResearchPage />} />
        <Route path="outline" element={<OutlinePage />} />
        <Route path="books" element={<BookListPage />} />
        <Route path="books/:bookId" element={<BookDetailPage />}>
          <Route index element={<BookOutlineTab />} />
          <Route path="editor" element={<BookEditorTab />} />
        </Route>
        {/* 旧路由重定向 */}
        <Route path="expansion" element={<Navigate to="/books" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
