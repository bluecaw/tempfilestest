import React, { useState, useEffect } from 'react';
import api from './api'; // 既存の api インスタンスをインポート

export default function PasswordReset({ onBackToLogin }) {
    // ステップ管理: 1 = メールアドレス入力, 2 = 6桁コード＆新パスワード入力, 3 = 完了
    const [step, setStep] = useState(1);

    // フォーム状態
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // UI状態
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    // ★ 成功メッセージ（message）がセットされたら 5 秒後に自動消去するタイマー
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => {
                setMessage('');
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [message]);

    // ★ エラーメッセージ（error）も 5 秒後に自動消去したい場合（不要であれば削除可）
    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => {
                setError('');
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [error]);

    // Step 1: 認証コード発行リクエスト
    const handleRequestOtp = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');

        if (!email) {
            setError('メールアドレスを入力してください。');
            return;
        }

        setLoading(true);
        try {
            const res = await api.post('/auth/password-reset/request/', { email });
            setMessage(res.data.detail);
            setStep(2); // コード入力画面に進む
        } catch (err) {
            setError(
                err.response?.data?.detail || '認証コードの送信に失敗しました。もう一度お試しください。'
            );
        } finally {
            setLoading(false);
        }
    };

    // Step 2: 認証コード確認＆パスワード変更リクエスト
    const handleConfirmOtp = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');

        if (!otp || !newPassword || !confirmPassword) {
            setError('すべての項目を入力してください。');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('新しいパスワードが一致しません。');
            return;
        }

        if (newPassword.length < 8) {
            setError('パスワードは8文字以上にしてください。');
            return;
        }

        setLoading(true);
        try {
            const res = await api.post('/auth/password-reset/confirm/', {
                email,
                otp,
                new_password: newPassword,
            });
            setMessage(res.data.detail);
            setStep(3); // 完了画面
        } catch (err) {
            setError(
                err.response?.data?.detail || 'パスワードの変更に失敗しました。コードを確認してください。'
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <h2 style={styles.title}>パスワードの再設定</h2>

                {error && <div style={styles.errorMessage}>{error}</div>}
                {message && <div style={styles.successMessage}>{message}</div>}

                {/* STEP 1: メールアドレス入力 */}
                {step === 1 && (
                    <form onSubmit={handleRequestOtp}>
                        <p style={styles.description}>
                            登録済みのメールアドレスを入力してください。認証コード（6桁）をお送りします。
                        </p>
                        <div style={styles.field}>
                            <label style={styles.label}>メールアドレス</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="example@domain.com"
                                style={styles.input}
                                required
                            />
                        </div>

                        <button type="submit" disabled={loading} style={styles.button}>
                            {loading ? '送信中...' : '認証コードを送信'}
                        </button>
                    </form>
                )}

                {/* STEP 2: コード入力 ＆ 新パスワード設定 */}
                {step === 2 && (
                    <form onSubmit={handleConfirmOtp}>
                        <p style={styles.description}>
                            <b>{email}</b> 宛に送られた6桁の認証コードと新しいパスワードを入力してください。
                        </p>

                        <div style={styles.field}>
                            <label style={styles.label}>認証コード（6桁）</label>
                            <input
                                type="text"
                                maxLength={6}
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                placeholder="123456"
                                style={{ ...styles.input, letterSpacing: '4px', textAlign: 'center', fontSize: '18px' }}
                                required
                            />
                        </div>

                        <div style={styles.field}>
                            <label style={styles.label}>新しいパスワード</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="8文字以上"
                                style={styles.input}
                                required
                            />
                        </div>

                        <div style={styles.field}>
                            <label style={styles.label}>新しいパスワード（確認）</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="もう一度入力"
                                style={styles.input}
                                required
                            />
                        </div>

                        <button type="submit" disabled={loading} style={styles.button}>
                            {loading ? '更新中...' : 'パスワードを変更する'}
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setStep(1);
                                setError('');
                                setMessage('');
                            }}
                            style={styles.textButton}
                        >
                            ← メールアドレス入力に戻る
                        </button>
                    </form>
                )}

                {/* STEP 3: 完了画面 */}
                {step === 3 && (
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ margin: '20px 0', color: '#16a34a' }}>
                            パスワードの変更が完了しました！新しいパスワードでログインしてください。
                        </p>
                        <button onClick={onBackToLogin} style={styles.button}>
                            ログイン画面へ戻る
                        </button>
                    </div>
                )}

                {step !== 3 && onBackToLogin && (
                    <button type="button" onClick={onBackToLogin} style={styles.textButton}>
                        ログイン画面へ戻る
                    </button>
                )}
            </div>
        </div>
    );
}

const styles = {
    container: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' },
    card: { width: '100%', maxWidth: '400px', padding: '30px', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' },
    title: { fontSize: '20px', fontWeight: 'bold', marginBottom: '16px', textAlign: 'center', color: '#333' },
    description: { fontSize: '14px', color: '#4a5568', marginBottom: '20px', lineHeight: '1.5' },
    field: { marginBottom: '16px' },
    label: { display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '6px', color: '#333' },
    input: { width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box', color: '#333' },
    button: { width: '100%', padding: '12px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' },
    textButton: { width: '100%', padding: '8px', backgroundColor: 'transparent', color: '#64748b', border: 'none', cursor: 'pointer', marginTop: '12px', fontSize: '13px' },
    errorMessage: { backgroundColor: '#fef2f2', color: '#dc2626', padding: '10px', borderRadius: '4px', marginBottom: '16px', fontSize: '13px' },
    successMessage: { backgroundColor: '#f0fdf4', color: '#16a34a', padding: '10px', borderRadius: '4px', marginBottom: '16px', fontSize: '13px' },
};