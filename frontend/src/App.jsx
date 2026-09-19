import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// -----------------------------------------------
// axios グローバル設定: Cookie を自動送信
// -----------------------------------------------
axios.defaults.withCredentials = true;

/**
 * DjangoのCSRF Cookieから csrf トークンを取得するユーティリティ
 */
function getCsrfToken() {
  const name = 'csrftoken';
  const cookies = document.cookie.split(';');
  for (let c of cookies) {
    const trimmed = c.trim();
    if (trimmed.startsWith(name + '=')) {
      return decodeURIComponent(trimmed.slice(name.length + 1));
    }
  }
  return '';
}

/**
 * 認証が必要なリクエスト用 axios インスタンス
 * X-CSRFToken ヘッダーを自動付与する
 */
const authAxios = axios.create({ withCredentials: true });
authAxios.interceptors.request.use((config) => {
  const csrfToken = getCsrfToken();
  if (csrfToken) {
    config.headers['X-CSRFToken'] = csrfToken;
  }
  return config;
});

// 401 レスポンス時に自動でリフレッシュを試みるインターセプター
authAxios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh/')
    ) {
      originalRequest._retry = true;
      try {
        await authAxios.post(`${API_BASE}/auth/refresh/`);
        return authAxios(originalRequest);
      } catch {
        // リフレッシュ失敗 → ページをリロードしてログイン画面へ
        window.location.reload();
      }
    }
    return Promise.reject(error);
  }
);

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [reports, setReports] = useState([]);
  const [formData, setFormData] = useState({
    report_no: '',
    reception_no: '',
    date: new Date().toISOString().split('T')[0],
    title: '',
    address: '',
    description: ''
  });
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [selectedReport, setSelectedReport] = useState(null);


  // -------------------------------------------
  // 認証チェック: ページロード時に Cookie で認証状態を確認
  // -------------------------------------------
  const checkAuth = useCallback(async () => {
    try {
      const res = await authAxios.get(`${API_BASE}/reports/`);
      setIsAuthenticated(true);
      setReports(res.data);
    } catch {
      setIsAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Cookie ベース ログイン処理
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await authAxios.post(`${API_BASE}/auth/login/`, { username, password });
      setIsAuthenticated(true);
      setCurrentUser(res.data.username || username);
      setMessage({ type: 'success', text: 'ログインしました。' });
      // ログイン後にデータを取得
      fetchReports();
    } catch (err) {
      setMessage({ type: 'error', text: 'ログイン失敗: ユーザー名またはパスワードを確認してください。' });
    }
  };

  // ログアウト処理: サーバーに logout エンドポイントを呼び Cookie を削除
  const handleLogout = async () => {
    try {
      await authAxios.post(`${API_BASE}/auth/logout/`);
    } catch {
      // エラーでもローカル状態はリセット
    }
    setIsAuthenticated(false);
    setCurrentUser('');
    setReports([]);
    setMessage({ type: 'info', text: 'ログアウトしました。' });
  };

  // 報告一覧の取得
  const fetchReports = async () => {
    try {
      const res = await authAxios.get(`${API_BASE}/reports/`);
      setReports(res.data);
    } catch (err) {
      if (err.response?.status === 401) {
        setIsAuthenticated(false);
      }
    }
  };

  // フォーム入力変更
  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // 添付ファイル選択
  const handleFileChange = (e) => {
    setFiles(Array.from(e.target.files));
  };

  // 業務報告登録 ＆ ファイル一括アップロード
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) return;
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // 1. Report 作成
      const reportRes = await authAxios.post(`${API_BASE}/reports/`, formData);
      const reportId = reportRes.data.id;

      // 2. 各添付ファイルのアップロード
      for (const file of files) {
        const uploadData = new FormData();
        uploadData.append('report_id', reportId);
        uploadData.append('file', file);

        await authAxios.post(`${API_BASE}/attachments/`, uploadData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      setMessage({ type: 'success', text: '業務報告と添付ファイルの登録が完了しました。' });
      setFormData({
        report_no: '',
        reception_no: '',
        date: new Date().toISOString().split('T')[0],
        title: '',
        address: '',
        description: ''
      });
      setFiles([]);
      fetchReports();
    } catch (err) {
      setMessage({ type: 'error', text: '登録中にエラーが発生しました: ' + (err.response?.data?.detail || JSON.stringify(err.response?.data) || err.message) });
    } finally {
      setLoading(false);
    }
  };

  // 添付ファイルダウンロード処理
  const handleDownloadAttachment = async (attId) => {
    try {
      const res = await authAxios.get(`${API_BASE}/attachments/${attId}/download/`);
      if (res.data.is_mock) {
        alert(`モック環境: ${res.data.message}\nKey: ${res.data.r2_key}`);
        return;
      }
      if (res.data.download_url) {
        window.location.href = res.data.download_url;
      }
    } catch (err) {
      alert('ダウンロードに失敗しました。');
    }
  };


  if (!isAuthenticated) {
    return (
      <div className="login-wrapper">
        <div className="login-card glass-panel">
          <div className="brand-header">
            <span className="brand-icon">📋</span>
            <h2>業務報告システム</h2>
            <p>Cloudflare R2 添付ファイル統合プラットフォーム</p>
          </div>

          <form onSubmit={handleLogin} className="login-form">
            <div className="input-field">
              <label>ユーザー名</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="ユーザー名を入力"
                required
              />
            </div>
            <div className="input-field">
              <label>パスワード</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="パスワードを入力"
                required
              />
            </div>
            <button type="submit" className="btn-glow">ログイン</button>
          </form>
          {message.text && <div className={`banner ${message.type}`}>{message.text}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* 側頭ヘッダー */}
      <header className="main-header glass-header">
        <div className="header-left">
          <span className="logo-badge">R2</span>
          <h1>業務報告管理システム</h1>
        </div>
        <div className="header-right">
          {currentUser && <span className="user-badge">👤 {currentUser}</span>}
          <span className="status-indicator">● オンライン</span>
          <button onClick={handleLogout} className="btn-outline">ログアウト</button>
        </div>
      </header>

      {message.text && (
        <div className={`toast-banner ${message.type}`}>
          {message.text}
          <button onClick={() => setMessage({ type: '', text: '' })}>✕</button>
        </div>
      )}

      <main className="content-grid">
        {/* 新規登録フォーム */}
        <section className="card form-section glass-panel">
          <div className="card-header">
            <h2>新規業務報告の登録</h2>
            <span className="subtitle">日付・件名・詳細・添付ファイルを指定</span>
          </div>

          <form onSubmit={handleSubmit} className="report-form">
            <div className="form-row">
              <div className="input-field">
                <label>報告日付 *</label>
                <input type="date" name="date" value={formData.date} onChange={handleInputChange} required />
              </div>
              <div className="input-field">
                <label>件名番号 *</label>
                <input type="text" name="report_no" placeholder="例: 0001" value={formData.report_no} onChange={handleInputChange} required />
              </div>
              <div className="input-field">
                <label>受付番号 *</label>
                <input type="text" name="reception_no" placeholder="例: REC-2026-001" value={formData.reception_no} onChange={handleInputChange} required />
              </div>
            </div>

            <div className="form-row">
              <div className="input-field full-width">
                <label>件名 *</label>
                <input type="text" name="title" placeholder="例: ○○地区 定期点検作業報告" value={formData.title} onChange={handleInputChange} required />
              </div>
            </div>

            <div className="form-row">
              <div className="input-field full-width">
                <label>住所</label>
                <input type="text" name="address" placeholder="例: 東京都千代田区1-1-1" value={formData.address} onChange={handleInputChange} />
              </div>
            </div>

            <div className="input-field">
              <label>業務内容詳細 *</label>
              <textarea name="description" rows="4" placeholder="具体的な作業内容、進捗、特記事項を入力してください..." value={formData.description} onChange={handleInputChange} required></textarea>
            </div>

            <div className="file-upload-area">
              <label className="file-label">
                <span className="upload-icon">📎</span>
                <div>
                  <strong>添付ファイルを選択 (複数可)</strong>
                  <p>写真 (JPG/PNG), PDF, Excel (XLSX), Word, ZIP 等 (最大50MB/ファイル)</p>
                </div>
                <input type="file" multiple onChange={handleFileChange} className="hidden-file-input" />
              </label>
              {files.length > 0 && (
                <ul className="selected-files-list">
                  {files.map((f, idx) => (
                    <li key={idx}>📄 {f.name} ({(f.size / 1024).toFixed(1)} KB)</li>
                  ))}
                </ul>
              )}
            </div>

            <button type="submit" disabled={loading} className="btn-glow submit-btn">
              {loading ? '保存・R2へファイル送信中...' : '業務報告を送信・登録'}
            </button>
          </form>
        </section>

        {/* 報告一覧 */}
        <section className="card list-section glass-panel">
          <div className="card-header">
            <h2>登録済み報告一覧 ({reports.length} 件)</h2>
          </div>

          <div className="reports-scroll">
            {reports.length === 0 ? (
              <div className="empty-state">
                <p>登録された業務報告はありません。</p>
              </div>
            ) : (
              reports.map(r => (
                <div key={r.id} className="report-card-item">
                  <div className="item-top">
                    <div className="tags">
                      <span className="tag-no">No. {r.report_no}</span>
                      <span className="tag-rec">受付: {r.reception_no}</span>
                    </div>
                    <span className="item-date">{r.date}</span>
                  </div>

                  <h3 className="item-title">{r.title}</h3>
                  {r.address && <p className="item-address">📍 {r.address}</p>}
                  <p className="item-desc">{r.description}</p>

                  <div className="item-footer">
                    <span className="item-author">👤 担当: {r.created_by?.username || '未定義'}</span>
                  </div>

                  {r.attachments && r.attachments.length > 0 && (
                    <div className="item-attachments">
                      <h4>添付ファイル ({r.attachments.length})</h4>
                      <div className="attachment-chips">
                        {r.attachments.map(att => (
                          <button
                            key={att.id}
                            type="button"
                            onClick={() => handleDownloadAttachment(att.id)}
                            className="attachment-chip"
                          >
                            📎 {att.original_filename} <small>({(att.file_size / 1024).toFixed(0)} KB)</small>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
