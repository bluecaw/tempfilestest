// src/Reports.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from './api';
import { ReportFilterBar } from './ReportFilterBar';
import DatePicker, { registerLocale } from 'react-datepicker';
import { ja } from 'date-fns/locale/ja';
import 'react-datepicker/dist/react-datepicker.css';

registerLocale('ja', ja);

export default function Reports() {
    const token = localStorage.getItem('jwt_token');
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

    const [editingReport, setEditingReport] = useState(null);
    const [editFormData, setEditFormData] = useState({
        report_no: '',
        reception_no: '',
        date: '',
        title: '',
        address: '',
        description: ''
    });
    const [editLoading, setEditLoading] = useState(false);

    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [geoLoading, setGeoLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const gsiMuniMapRef = useRef(null);

    useEffect(() => {
        if (message.text) {
            const timer = setTimeout(() => setMessage({ type: '', text: '' }), 5000);
            return () => clearTimeout(timer);
        }
    }, [message]);

    const fetchReports = useCallback(async (currentFilters = filters) => {
        if (!token) return;
        try {
            const params = {};
            Object.entries(currentFilters).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') params[key] = value;
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

    const handleSearch = (newFilters) => setFilters(newFilters);
    const handleReset = () => setFilters({});

    const handleDownloadAttachment = async (attachmentId) => {
        try {
            const res = await api.get(`/attachments/${attachmentId}/download/`);
            if (res.data.download_url) window.open(res.data.download_url, '_blank');
        } catch (err) {
            console.error('ダウンロードURL取得エラー:', err);
        }
    };

    const handleInputChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
    const handleEditInputChange = (e) => setEditFormData({ ...editFormData, [e.target.name]: e.target.value });
    const handleFileChange = (e) => setFiles(Array.from(e.target.files));

    const handleStartEdit = (report) => {
        setEditingReport(report);
        setEditFormData({
            report_no: report.report_no || '',
            reception_no: report.reception_no || '',
            date: report.date || '',
            title: report.title || '',
            address: report.address || '',
            description: report.description || ''
        });
    };

    const handleUpdateSubmit = async (e) => {
        e.preventDefault();
        if (!editingReport) return;
        setEditLoading(true);
        try {
            await api.patch(`/reports/${editingReport.id}/`, editFormData);
            setMessage({ type: 'success', text: '業務報告を更新しました。' });
            setEditingReport(null);
            fetchReports();
        } catch (err) {
            setMessage({ type: 'error', text: '更新に失敗しました: ' + (err.response?.data?.detail || '入力内容を確認') });
        } finally {
            setEditLoading(false);
        }
    };

    const fetchMuniMap = async () => {
        if (gsiMuniMapRef.current) return gsiMuniMapRef.current;
        try {
            const res = await fetch('/muni.json');
            if (!res.ok) throw new Error('muni.json の取得に失敗しました');
            const parsedData = await res.json();
            gsiMuniMapRef.current = parsedData;
            return parsedData;
        } catch (e) {
            return null;
        }
    };

    const handleGetLocation = () => {
        if (!navigator.geolocation) return alert('GPS非対応です。');
        setGeoLoading(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { latitude, longitude } = position.coords;
                    const [res, muniData] = await Promise.all([
                        fetch(`https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?lon=${longitude}&lat=${latitude}`),
                        fetchMuniMap()
                    ]);
                    if (!res.ok) throw new Error('住所取得失敗');
                    const data = await res.json();
                    if (data.results) {
                        const { muniCd, lv01Nm } = data.results;
                        let fullAddress = '';
                        if (muniData) {
                            const key = muniCd ? muniCd.replace(/^0+/, '') : '';
                            const targetInfo = muniData[key] || muniData[muniCd];
                            if (targetInfo) {
                                const parts = targetInfo.split(',');
                                fullAddress = `${parts[1] || ''}${(parts[3] || '').replace(/\s+/g, '')}${lv01Nm || ''}`;
                            }
                        }
                        if (!fullAddress) fullAddress = lv01Nm || '';
                        if (fullAddress) {
                            setFormData((prev) => ({ ...prev, address: fullAddress }));
                            setMessage({ type: 'success', text: '住所を自動入力しました。' });
                        }
                    }
                } catch (error) {
                    alert('住所の自動取得に失敗しました。');
                } finally {
                    setGeoLoading(false);
                }
            },
            (error) => {
                setGeoLoading(false);
                alert('位置情報が取得できませんでした。');
            },
            { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const reportRes = await api.post('/reports/', formData);
            const reportId = reportRes.data.id;
            for (const file of files) {
                const uploadData = new FormData();
                uploadData.append('report_id', reportId);
                uploadData.append('file', file);
                await api.post('/attachments/', uploadData, { headers: { 'Content-Type': 'multipart/form-data' } });
            }
            setMessage({ type: 'success', text: '業務報告を登録しました。' });
            setFormData({ report_no: '', reception_no: '', date: new Date().toISOString().split('T')[0], title: '', address: '', description: '' });
            setFiles([]);
            fetchReports();
        } catch (err) {
            setMessage({ type: 'error', text: '登録エラーが発生しました。' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {message.text && (
                <div className={`toast-banner ${message.type}`}>
                    {message.text}
                    <button onClick={() => setMessage({ type: '', text: '' })}>✕</button>
                </div>
            )}

            <main className="content-grid">
                <section className="card form-section glass-panel">
                    <div className="card-header">
                        <h2>新規業務報告の登録</h2>
                    </div>
                    <form onSubmit={handleSubmit} className="report-form">
                        <div className="form-row">
                            <div className="input-field">
                                <label>報告日付 *</label>
                                <DatePicker
                                    selected={formData.date ? new Date(formData.date.replace(/-/g, '/')) : null}
                                    onChange={(date) => {
                                        if (!date) return handleInputChange({ target: { name: 'date', value: '' } });
                                        handleInputChange({ target: { name: 'date', value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` } });
                                    }}
                                    dateFormat="yyyy/MM/dd"
                                    locale="ja"
                                    placeholderText="年/月/日"
                                    required
                                />
                            </div>
                            <div className="input-field">
                                <label>件名番号 *</label>
                                <input
                                    type="text"
                                    name="report_no"
                                    placeholder="例: 0001"
                                    value={formData.report_no}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>
                            <div className="input-field">
                                <label>受付番号 *</label>
                                <input
                                    type="text"
                                    name="reception_no"
                                    placeholder="例: REC-2026-001"
                                    value={formData.reception_no}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="input-field full-width">
                                <label>件名 *</label>
                                <input
                                    type="text"
                                    name="title"
                                    placeholder="例: ○○地区 定期点検作業報告"
                                    value={formData.title}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="input-field full-width">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <label style={{ margin: 0 }}>住所</label>
                                    <button
                                        type="button"
                                        onClick={handleGetLocation}
                                        disabled={geoLoading}
                                        className="btn-outline"
                                        style={{ padding: '2px 8px', fontSize: '12px' }}
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
                            <textarea
                                name="description"
                                rows="4"
                                placeholder="具体的な作業内容、進捗、特記事項を入力してください..."
                                value={formData.description}
                                onChange={handleInputChange}
                                required
                            />
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
                                    {files.map((f, i) => (
                                        <li key={i}>📄 {f.name} ({(f.size / 1024).toFixed(1)} KB)</li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <button type="submit" disabled={loading} className="btn-glow submit-btn">
                            {loading ? '保存・R2へファイル送信中...' : '業務報告を送信・登録'}
                        </button>
                    </form>
                </section>

                <section className="card list-section glass-panel">
                    <div className="card-header">
                        <h2>登録済み報告一覧 ({reports.length} 件)</h2>
                    </div>
                    <ReportFilterBar onSearch={handleSearch} onReset={handleReset} />
                    <div className="reports-scroll">
                        {reports.map(r => (
                            <div key={r.id} className="report-card-item">
                                <div className="item-top">
                                    <div className="tags">
                                        <span className="tag-no">No. {r.report_no}</span>
                                        <span className="tag-rec">受付: {r.reception_no}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span className="item-date">{r.date}</span>
                                        <button type="button" onClick={() => handleStartEdit(r)} className="btn-outline" style={{ padding: '2px 8px', fontSize: '12px' }}>✏️ 編集</button>
                                    </div>
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
                                    <span className="item-author">👤 担当: {r.created_by?.username || r.user?.username || '未定義'}</span>
                                </div>
                                {r.attachments?.length > 0 && (
                                    <div className="item-attachments">
                                        <div className="attachment-chips">
                                            {r.attachments.map(att => (
                                                <button key={att.id} type="button" onClick={() => handleDownloadAttachment(att.id)} className="attachment-chip">
                                                    📎 {att.original_filename}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            </main>

            {/* 編集モーダル */}
            {editingReport && (
                <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
                    <div className="glass-panel" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', background: '#1e293b' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0, color: '#f8fafc' }}>✏️ 編集 (No. {editingReport.report_no})</h3>
                            <button onClick={() => setEditingReport(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}>✕</button>
                        </div>
                        <form onSubmit={handleUpdateSubmit} className="report-form">
                            <div className="form-row">
                                <div className="input-field"><label>日付 *</label><input type="date" name="date" value={editFormData.date} onChange={handleEditInputChange} required /></div>
                                <div className="input-field"><label>件名番号 *</label><input type="text" name="report_no" value={editFormData.report_no} onChange={handleEditInputChange} required /></div>
                                <div className="input-field"><label>受付番号 *</label><input type="text" name="reception_no" value={editFormData.reception_no} onChange={handleEditInputChange} required /></div>
                            </div>
                            <div className="input-field full-width"><label>件名 *</label><input type="text" name="title" value={editFormData.title} onChange={handleEditInputChange} required /></div>
                            <div className="input-field full-width"><label>住所</label><input type="text" name="address" value={editFormData.address} onChange={handleEditInputChange} /></div>
                            <div className="input-field"><label>詳細 *</label><textarea name="description" rows="4" value={editFormData.description} onChange={handleEditInputChange} required /></div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
                                <button type="button" onClick={() => setEditingReport(null)} className="btn-outline">キャンセル</button>
                                <button type="submit" disabled={editLoading} className="btn-glow">{editLoading ? '更新中...' : '保存'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}