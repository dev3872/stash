import { Route, Routes } from 'react-router';
import { Layout } from './components/Layout.jsx';
import { FeedPage } from './pages/FeedPage.jsx';
import { PostPage } from './pages/PostPage.jsx';
import { CreatePage } from './pages/CreatePage.jsx';
import { TopicPage } from './pages/TopicPage.jsx';
import { SequencePage } from './pages/SequencePage.jsx';
import { ProfilePage } from './pages/ProfilePage.jsx';
import { UserPage } from './pages/UserPage.jsx';
import { MessagesPage } from './pages/MessagesPage.jsx';
import { ConversationPage } from './pages/ConversationPage.jsx';
import { NotFoundPage } from './pages/NotFoundPage.jsx';
import { LessonPlayer } from './pages/LessonPlayer.jsx';
import { ExplorePage } from './pages/ExplorePage.jsx';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<FeedPage />} />
        <Route path="posts/:id" element={<PostPage />} />
        <Route path="create" element={<CreatePage />} />
        <Route path="topics/:slug" element={<TopicPage />} />
        <Route path="sequences/:id" element={<SequencePage />} />
        <Route path="learn/:id" element={<LessonPlayer />} />
        <Route path="explore" element={<ExplorePage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="users/:id" element={<UserPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="messages/:id" element={<ConversationPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
