import React, { useState, useEffect, useCallback } from 'react';
import api from './api';
import PasswordReset from './PasswordReset';
import { NotificationBell } from './NotificationBell';
import { ReportFilterBar } from './ReportFilterBar'; // ★ 検索・フィルターバーのインポート

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('jwt_token') || '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isResetMode, setIsResetMode] = useState(false);

  const [reports, setReports] = useState([]);
  const [filters, setFilters] = useState({}); // ★ 検索・フィルター条件の状態管理
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

  // JWT ログイン処理
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/auth/token/', { username, password });
      setToken(res.data.access);
      localStorage.setItem('jwt_token', res.data.access);
      setMessage({ type: 'success', text: 'ログインしました。' });
    } catch (err) {
      setMessage({ type: 'error', text: 'ログイン失敗: ユーザー名またはパスワードを確認してください。' });
    }
  };

  // ログアウト処理
  const handleLogout = () => {
    setToken('');
    localStorage.removeItem('jwt_token');
    setReports([]);
    setMessage({ type: 'info', text: 'ログアウトしました。' });
  };

  // ★ 報告一覧の取得（フィルター条件を反映）
  const fetchReports = useCallback(async (currentFilters = filters) => {
    if (!token) return;
    try {
      // 空値のパラメータを除外して作成
      const params = {};
      Object.entries(currentFilters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params[key] = value;
        }
      });

      const res = await api.get('/reports/', { params });
      // DRF のページネーション（results）あり・なし両方に対応
      setReports(Array.isArray(res.data) ? res.data : res.data.results || []);
    } catch (err) {
      console.error('報告一覧の取得に失敗しました:', err);
    }
  }, [token, filters]);

  // ★ トークンまたはフィルター条件変更時に自動で取得
  useEffect(() => {
    fetchReports(filters);
  }, [token, filters, fetchReports]);

  // ★ 検索実行ハンドラー
  const handleSearch = (newFilters) => {
    setFilters(newFilters);
  };

  // ★ 検索リセットハンドラー
  const handleReset = () => {
    setFilters({});
  };

  // 添付ファイルダウンロード処理
  const handleDownloadAttachment = async (attachmentId) => {
    try {
      const res = await api.get(`/attachments/${attachmentId}/download/`);
      if (res.data.download_url) {
        window.open(res.data.download_url, '_blank');
      }
    } catch (err) {
      console.error('ダウンロードURL取得エラー:', err);
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
    if (!token) return;
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const payload = {
        report_no: formData.report_no,
        reception_no: formData.reception_no,
        date: formData.date,
        title: formData.title,
        address: formData.address,
        description: formData.description,
      };

      // 1. Report 作成 (POST)
      const reportRes = await api.post('/reports/', payload);
      const reportId = reportRes.data.id;

      // 2. 各添付ファイルのアップロード
      for (const file of files) {
        const uploadData = new FormData();
        uploadData.append('report_id', reportId);
        uploadData.append('file', file);

        await api.post('/attachments/', uploadData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
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

  // 未ログイン状態の画面表示制御
  if (!token) {
    if (isResetMode) {
      return <PasswordReset onBackToLogin={() => setIsResetMode(false)} />;
    }

    return (
      <div className="login-wrapper">
        <div className="login-card glass-panel">
          <div className="brand-header">
            <img src="/vite.svg" className="brand-icon" alt="Vite Logo" style={{ width: '40px', height: '40px' }} />
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

            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => setIsResetMode(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#60a5fa',
                  cursor: 'pointer',
                  fontSize: '14px',
                  textDecoration: 'underline'
                }}
              >
                パスワードをお忘れの方はこちら
              </button>
            </div>
          </form>
          {message.text && <div className={`banner ${message.type}`}>{message.text}</div>}
        </div>
      </div>
    );
  }

  // ログイン後のメイン画面
  return (
    <div className="app-layout">
      {/* ヘッダー */}
      <header className="main-header glass-header">
        <div className="header-left">
          <img src="/vite.svg" alt="Vite Logo" style={{ width: '28px', height: '28px', marginRight: '10px' }} />
          <h1>業務報告管理システム</h1>
        </div>
        <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <NotificationBell accessToken={token} />
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

          {/* ★ 検索・フィルターバーを配置 */}
          <ReportFilterBar onSearch={handleSearch} onReset={handleReset} />

          <div className="reports-scroll">
            {reports.length === 0 ? (
              <div className="empty-state">
                <p>該当する業務報告はありません。</p>
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
                  {r.address && (
                    <p className="item-address">
                      📍{' '}
                      <a
                        href={
                          r.latitude && r.longitude
                            ? `https://www.google.com/maps?q=${r.latitude},${r.longitude}`
                            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.address)}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#60a5fa', textDecoration: 'underline', cursor: 'pointer' }}
                      >
                        {r.address}
                      </a>
                    </p>
                  )}
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