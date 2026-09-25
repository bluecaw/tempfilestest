import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from './api';
import PasswordReset from './PasswordReset';
import { NotificationBell } from './NotificationBell';
import { ReportFilterBar } from './ReportFilterBar';
import Portal from './Portal';
import DatePicker, { registerLocale } from 'react-datepicker';
import { ja } from 'date-fns/locale/ja';
import 'react-datepicker/dist/react-datepicker.css';

registerLocale('ja', ja);

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('jwt_token') || '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isResetMode, setIsResetMode] = useState(false);
  const [currentView, setCurrentView] = useState('reports');

  const [reports, setReports] = useState([]);
  const [filters, setFilters] = useState({});
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
  const [geoLoading, setGeoLoading] = useState(false); // 位置情報取得中のローディング状態
  const [message, setMessage] = useState({ type: '', text: '' });

  // 国土地理院の自治体マスター（muni.js）キャッシュ用 Ref
  const gsiMuniMapRef = useRef(null);

  // メッセージが表示されたら 5 秒後に自動で消去するタイマー
  useEffect(() => {
    if (message.text) {
      const timer = setTimeout(() => {
        setMessage({ type: '', text: '' });
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [message]);

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

  // 報告一覧の取得（フィルター条件を反映）
  const fetchReports = useCallback(async (currentFilters = filters) => {
    if (!token) return;
    try {
      const params = {};
      Object.entries(currentFilters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params[key] = value;
        }
      });

      const res = await api.get('/reports/', { params });
      setReports(Array.isArray(res.data) ? res.data : res.data.results || []);
    } catch (err) {
      console.error('報告一覧の取得に失敗しました:', err);
    }
  }, [token, filters]);

  useEffect(() => {
    fetchReports(filters);
  }, [token, filters, fetchReports]);

  // 検索実行ハンドラー
  const handleSearch = (newFilters) => {
    setFilters(newFilters);
  };

  // 検索リセットハンドラー
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

  // 全国版 muni.json を public フォルダから取得・キャッシュする関数
  const fetchMuniMap = async () => {
    if (gsiMuniMapRef.current) return gsiMuniMapRef.current;
    try {
      const res = await fetch('/muni.json');
      if (!res.ok) throw new Error('muni.json の取得に失敗しました');

      const parsedData = await res.json();
      gsiMuniMapRef.current = parsedData;
      return parsedData;
    } catch (e) {
      console.error('全国自治体マスターの取得に失敗しました:', e);
      return null;
    }
  };

  // コンポーネント内の位置情報取得ハンドラー
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert('お使いのブラウザは位置情報（GPS）に対応していません。');
      return;
    }

    setGeoLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;

          // 逆ジオコーディング API 呼び出しとローカル自治体マスター取得を並列実行
          const [res, muniData] = await Promise.all([
            fetch(`https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?lon=${longitude}&lat=${latitude}`),
            fetchMuniMap()
          ]);

          if (!res.ok) throw new Error('住所情報の取得に失敗しました');

          const data = await res.json();
          if (data.results) {
            const { muniCd, lv01Nm } = data.results;
            let fullAddress = '';

            if (muniData) {
              // muniCd (例: "01101") から先頭の '0' を取り除いて "1101" のキーで検索
              const key = muniCd ? muniCd.replace(/^0+/, '') : '';
              const targetInfo = muniData[key] || muniData[muniCd];

              if (targetInfo) {
                const parts = targetInfo.split(',');
                // parts[1]: 都道府県 (例: 北海道)
                // parts[3]: 市区町村 (例: 札幌市 中央区)
                const prefName = parts[1] || '';
                const muniName = (parts[3] || '').replace(/\s+/g, ''); // 全角・半角スペースの除去

                // 例: "北海道" + "札幌市中央区" + "北一条西二丁目"
                fullAddress = `${prefName}${muniName}${lv01Nm || ''}`;
              }
            }

            if (!fullAddress) {
              fullAddress = lv01Nm || '';
            }

            if (fullAddress) {
              setFormData((prev) => ({ ...prev, address: fullAddress }));
              setMessage({ type: 'success', text: '現在地から住所を自動入力しました。' });

              setTimeout(() => {
                const inputEl = document.querySelector('input[name="address"]');
                if (inputEl) {
                  inputEl.focus();
                  const len = inputEl.value.length;
                  inputEl.setSelectionRange(len, len);
                }
              }, 100);
            } else {
              alert('該当する住所情報が見つかりませんでした。');
            }
          } else {
            alert('該当する住所情報が見つかりませんでした。');
          }
        } catch (error) {
          console.error('位置情報変換エラー:', error);
          alert('住所の自動取得に失敗しました。手動で入力してください。');
        } finally {
          setGeoLoading(false);
        }
      },
      (error) => {
        setGeoLoading(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            alert('位置情報の利用が拒否されました。ブラウザの権限設定をご確認ください。');
            break;
          case error.POSITION_UNAVAILABLE:
            alert('位置情報が取得できませんでした。');
            break;
          case error.TIMEOUT:
            alert('位置情報の取得に時間がかかりすぎました。もう一度お試しください。');
            break;
          default:
            alert('位置情報の取得に失敗しました。');
            break;
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 60000
      }
    );
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

      const reportRes = await api.post('/reports/', payload);
      const reportId = reportRes.data.id;

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
        <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {currentView === 'reports' ? (
            <button onClick={() => setCurrentView('portal')} className="btn-outline">
              🔗 関連リンク集
            </button>
          ) : (
            <button onClick={() => setCurrentView('reports')} className="btn-outline">
              📋 業務報告へ
            </button>
          )}

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

      {currentView === 'portal' ? (
        <Portal onBack={() => setCurrentView('reports')} />
      ) : (
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
                  <DatePicker
                    selected={formData.date ? new Date(formData.date.replace(/-/g, '/')) : null}
                    onChange={(date) => {
                      if (!date) {
                        handleInputChange({ target: { name: 'date', value: '' } });
                        return;
                      }
                      const year = date.getFullYear();
                      const month = String(date.getMonth() + 1).padStart(2, '0');
                      const day = String(date.getDate()).padStart(2, '0');
                      const formattedDate = `${year}-${month}-${day}`;

                      handleInputChange({
                        target: {
                          name: 'date',
                          value: formattedDate
                        }
                      });
                    }}
                    dateFormat="yyyy/MM/dd"
                    locale="ja"
                    placeholderText="年/月/日"
                    required
                  />
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

              {/* 住所入力欄（自動取得ボタン付き） */}
              <div className="form-row">
                <div className="input-field full-width">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ margin: 0 }}>住所</label>
                    <button
                      type="button"
                      onClick={handleGetLocation}
                      disabled={geoLoading}
                      style={{
                        background: 'rgba(56, 189, 248, 0.15)',
                        color: '#38bdf8',
                        border: '1px solid rgba(56, 189, 248, 0.4)',
                        borderRadius: '6px',
                        padding: '4px 10px',
                        fontSize: '12px',
                        cursor: geoLoading ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {geoLoading ? '📍 取得中...' : '📍 現在地から自動入力'}
                    </button>
                  </div>
                  <input
                    type="text"
                    name="address"
                    placeholder="例: 東京都千代田区霞が関3-1-1"
                    value={formData.address}
                    onChange={handleInputChange}
                  />
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
      )}
    </div>
  );
}