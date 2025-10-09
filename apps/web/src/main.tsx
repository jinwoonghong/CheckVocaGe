import { render } from 'preact';
import { Route, Router } from 'wouter-preact';
import { useEffect } from 'preact/hooks';
import { QuizPage } from './pages/Quiz';
import { AuthContext, useProvideAuth } from './auth/firebase';

function Home() {
  useEffect(() => {}, []);
  return (
    <div style={{ padding: 16, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
      <h1>WebVoca</h1>
      <p>모바일 퀴즈는 /quiz 경로에서 이용할 수 있습니다.</p>
      <a href="/quiz">퀴즈로 이동</a>
    </div>
  );
}

function App() {
  const auth = useProvideAuth();
  return (
    <AuthContext.Provider value={auth}>
      <Router>
        <Route path="/" component={Home} />
        <Route path="/quiz" component={QuizPage} />
      </Router>
    </AuthContext.Provider>
  );
}

render(<App />, document.getElementById('root')!);
