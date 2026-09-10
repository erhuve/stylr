import './lib/zo-theme';
import StyleStudy from './pages/style-study';
import PhotoStudy from './pages/photo-study';

export default function App() {
  return window.location.pathname === '/illustrated' ? <StyleStudy /> : <PhotoStudy />;
}
