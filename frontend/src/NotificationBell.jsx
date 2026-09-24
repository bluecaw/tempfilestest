// NotificationBell.jsx
import React, { useEffect, useState } from 'react';
import { useNotificationSocket } from './useNotificationSocket';

export const NotificationBell = ({ accessToken }) => {
    const { notifications, latestNotification, isConnected } = useNotificationSocket(accessToken);
    const [toast, setToast] = useState(null);
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    // 新着通知が届いたらトーストを表示 & 未読数を加算
    useEffect(() => {
        if (latestNotification) {
            setToast(latestNotification);
            setUnreadCount((prev) => prev + 1);

            const timer = setTimeout(() => {
                setToast(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [latestNotification]);

    // ベルアイコン（ドロップダウン）を開いたら未読カウントをリセット
    const handleToggleOpen = () => {
        if (!isOpen) {
            setUnreadCount(0); // 開いたら未読をクリア
        }
        setIsOpen(!isOpen);
    };

    return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
            {/* 1. 通知トースト (画面右上ポップアップ) */}
            {toast && (
                <div style={{
                    position: 'fixed',
                    top: '20px',
                    right: '20px',
                    backgroundColor: '#1e293b',
                    color: '#fff',
                    padding: '12px 20px',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                    borderLeft: '4px solid #3b82f6',
                    zIndex: 9999,
                }}>
                    <strong style={{ color: '#60a5fa' }}>【リアルタイム通知】</strong>
                    <p style={{ margin: '4px 0 0', fontSize: '14px' }}>{toast.message}</p>
                </div>
            )}

            {/* 2. 通知ベルボタン（数字バッジ付き） */}
            <button
                onClick={handleToggleOpen}
                style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px' }}
            >
                🔔
                {/* 接続ステータス（小さなドット） */}
                <span style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: isConnected ? '#22c55e' : '#ef4444',
                    border: '1px solid #fff'
                }} title={isConnected ? 'WebSocket接続中' : '切断中'} />

                {/* ★ 未読カウント数字バッジ */}
                {unreadCount > 0 && (
                    <span style={{
                        position: 'absolute',
                        top: '-4px',
                        right: '-6px',
                        backgroundColor: '#ef4444',
                        color: 'white',
                        borderRadius: '10px',
                        padding: '1px 6px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        minWidth: '16px',
                        textAlign: 'center',
                        lineHeight: '14px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* 3. 通知履歴ドロップダウン */}
            {isOpen && (
                <div style={{
                    position: 'absolute',
                    right: 0,
                    top: '40px',
                    width: '300px',
                    maxHeight: '360px',
                    overflowY: 'auto',
                    backgroundColor: '#fff',
                    color: '#333',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    padding: '12px',
                    zIndex: 1000,
                    textAlign: 'left',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', marginBottom: '8px' }}>
                        <h4 style={{ margin: 0, fontSize: '14px', color: '#0f172a' }}>
                            通知履歴 ({notifications.length})
                        </h4>
                    </div>

                    {notifications.length === 0 ? (
                        <p style={{ fontSize: '12px', color: '#94a3b8', margin: '12px 0', textAlign: 'center' }}>新着通知はありません</p>
                    ) : (
                        notifications.map((item, index) => (
                            <div key={index} style={{
                                padding: '8px 0',
                                borderBottom: '1px solid #f8fafc',
                                fontSize: '13px'
                            }}>
                                <p style={{ margin: 0, color: '#334155', fontWeight: 500 }}>{item.message}</p>
                                <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                                    {item.created_at || 'たった今'}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};