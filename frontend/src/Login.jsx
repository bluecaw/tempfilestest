// src/Login.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from './api';
import PasswordReset from './PasswordReset';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isResetMode, setIsResetMode] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/auth/token/', { username, password });
            localStorage.setItem('jwt_token', res.data.access);

            // ログイン成功後、/reports へ安全に遷移（履歴に残る）
            navigate('/reports');
        } catch (err) {
            setMessage({ type: 'error', text: 'ログイン失敗: ユーザー名またはパスワードを確認してください。' });
        }
    };

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