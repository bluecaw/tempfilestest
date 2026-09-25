// src/App.jsx
import React from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation, Outlet } from 'react-router-dom';
import Login from './Login';
import Reports from './Reports';
import Portal from './Portal';
import ProtectedRoute from './ProtectedRoute';
import { NotificationBell } from './NotificationBell';

// ログイン後の共通レイアウト（ヘッダー部分）
function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem('jwt_token');

  const handleLogout = () => {
    localStorage.removeItem('jwt_token');
    // ログアウト時はログイン画面へ遷移（履歴を置き換える）
    navigate('/login', { replace: true });
  };

  return (
    <div className="app-layout">
      <header className="main-header glass-header">
        <div className="header-left">
          <img src="/vite.svg" alt="Vite Logo" style={{ width: '28px', height: '28px', marginRight: '10px' }} />
          <h1>業務報告管理システム</h1>
        </div>
        <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>

          {/* URLによってボタンのリンク先を切り替え */}
          {location.pathname === '/reports' ? (
            <button onClick={() => navigate('/portal')} className="btn-outline">
              🔗 関連リンク集
            </button>
          ) : (
            <button onClick={() => navigate('/reports')} className="btn-outline">
              📋 業務報告へ
            </button>
          )}

          <NotificationBell accessToken={token} />
          <span className="status-indicator">● オンライン</span>
          <button onClick={handleLogout} className="btn-outline">ログアウト</button>
        </div>
      </header>

      {/* <Outlet /> の位置に Reports.jsx や Portal.jsx が自動的に差し込まれます */}
      <Outlet />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* 未ログイン用ルート */}
      <Route path="/login" element={<Login />} />

      {/* ログイン必須ルート（ProtectedRoute でガード） */}
      <Route element={<ProtectedRoute />}>
        {/* ヘッダーを含む共通レイアウト */}
        <Route element={<AppLayout />}>
          <Route path="/reports" element={<Reports />} />
          <Route path="/portal" element={<Portal />} />

          {/* デフォルトのルートアクセス時は /reports へ自動リダイレクト */}
          <Route path="/" element={<Navigate to="/reports" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}