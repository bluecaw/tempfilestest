import React, { useState } from 'react';

// カテゴリ別リンク定義データ
const PORTAL_SECTIONS = [
    {
        category: '🚀 アプリケーション & 管理画面',
        description: '日々の業務運用・データ確認用システム',
        links: [
            {
                title: 'Django 管理画面 (Admin)',
                url: 'https://your-django-backend.onrender.com/admin/',
                description: '報告データ・ユーザー権限・操作ログの直接管理',
                badge: '管理者用',
                badgeColor: 'badge-red',
                icon: '⚙️',
            },
            {
                title: 'REST API 参照 (DRF Root)',
                url: 'https://your-django-backend.onrender.com/api/',
                description: 'バックエンド API のエンドポイント動作確認',
                badge: '開発者',
                badgeColor: 'badge-blue',
                icon: '🔌',
            },
            {
                title: 'Google Maps 検索',
                url: 'https://www.google.co.jp/maps',
                description: '住所データ・座標の手動位置確認',
                badge: '共通',
                badgeColor: 'badge-green',
                icon: '📍',
            },
        ],
    },
    {
        category: '☁️ インフラ & クラウド基盤',
        description: 'サーバーホスティング・ストレージ・DB管理',
        links: [
            {
                title: 'Render ダッシュボード',
                url: 'https://dashboard.render.com/',
                description: 'Webサービス・PostgreSQL・ビルドログの監視',
                badge: 'DevOps',
                badgeColor: 'badge-purple',
                icon: '🖥️',
            },
            {
                title: 'Cloudflare R2 コンソール',
                url: 'https://dash.cloudflare.com/',
                description: '添付ファイル用オブジェクトストレージの管理',
                badge: 'DevOps',
                badgeColor: 'badge-purple',
                icon: '📦',
            },
            {
                title: 'Upstash Console (Redis)',
                url: 'https://console.upstash.com/',
                description: 'Django Channels リアルタイム通信用 Redis 状態管理',
                badge: 'DevOps',
                badgeColor: 'badge-purple',
                icon: '⚡',
            },
        ],
    },
    {
        category: '🛠️ 外部 API & ソースコード',
        description: 'APIキー・使用量モニター・リポジトリ',
        links: [
            {
                title: 'Google Cloud Console',
                url: 'https://console.cloud.google.com/google/maps-apis/overview',
                description: 'Geocoding API の利用料金・キー制限設定',
                badge: 'GCP',
                badgeColor: 'badge-yellow',
                icon: '🗺️',
            },
            {
                title: 'GitHub リポジトリ',
                url: 'https://github.com/your-org/your-repo',
                description: 'ソースコード管理・Pull Request・Issue',
                badge: 'Git',
                badgeColor: 'badge-gray',
                icon: '🐙',
            },
        ],
    },
];

export default function Portal({ onBack }) {
    const [searchTerm, setSearchTerm] = useState('');

    // 検索キーワードによるフィルタリング
    const filteredSections = PORTAL_SECTIONS.map((section) => {
        const filteredLinks = section.links.filter(
            (link) =>
                link.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                link.description.toLowerCase().includes(searchTerm.toLowerCase())
        );
        return { ...section, links: filteredLinks };
    }).filter((section) => section.links.length > 0);

    return (
        <div className="portal-container" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
            {/* ヘッダーエリア */}
            <div className="portal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <button
                        onClick={onBack}
                        className="btn-outline"
                        style={{ marginBottom: '12px', cursor: 'pointer', padding: '6px 14px' }}
                    >
                        ← 業務報告画面に戻る
                    </button>
                    <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '4px 0' }}>開発・管理者用 ポータル</h1>
                    <p style={{ color: '#9ca3af', fontSize: '14px' }}>
                        関連システム・インフラダッシュボード・外部APIコンソールへの統合リンク集
                    </p>
                </div>

                {/* 検索バー */}
                <div style={{ minWidth: '260px' }}>
                    <input
                        type="text"
                        placeholder="🔍 サービスを検索..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            backgroundColor: 'rgba(15, 23, 42, 0.6)',
                            color: '#fff',
                            outline: 'none'
                        }}
                    />
                </div>
            </div>

            {/* カードリスト */}
            {filteredSections.length === 0 ? (
                <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: '#9ca3af' }}>
                    該当するサービスが見つかりませんでした。
                </div>
            ) : (
                filteredSections.map((section, idx) => (
                    <div key={idx} style={{ marginBottom: '32px' }}>
                        <div style={{ marginBottom: '14px' }}>
                            <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#e2e8f0' }}>{section.category}</h2>
                            <p style={{ fontSize: '12px', color: '#94a3b8' }}>{section.description}</p>
                        </div>

                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                                gap: '16px',
                            }}
                        >
                            {section.links.map((link, linkIdx) => (
                                <a
                                    key={linkIdx}
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="glass-panel portal-card"
                                    style={{
                                        display: 'block',
                                        padding: '18px',
                                        borderRadius: '12px',
                                        textDecoration: 'none',
                                        color: 'inherit',
                                        transition: 'all 0.2s ease-in-out',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ fontSize: '24px' }}>{link.icon}</span>
                                            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#f8fafc', margin: 0 }}>
                                                {link.title}
                                            </h3>
                                        </div>
                                        {link.badge && (
                                            <span className={`portal-badge ${link.badgeColor}`}>
                                                {link.badge}
                                            </span>
                                        )}
                                    </div>
                                    <p style={{ fontSize: '13px', color: '#94a3b8', margin: '6px 0 12px 0', lineHeight: '1.4' }}>
                                        {link.description}
                                    </p>
                                    <div style={{ fontSize: '12px', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <span>開く</span>
                                        <span>↗</span>
                                    </div>
                                </a>
                            ))}
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}