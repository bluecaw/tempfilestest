// src/Reports.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from './api';
import { ReportFilterBar } from './ReportFilterBar';
import DatePicker, { registerLocale } from 'react-datepicker';
import { ja } from 'date-fns/locale/ja';
import 'react-datepicker/dist/react-datepicker.css';
import Spinner from './Spinner';
import imageCompression from 'browser-image-compression';

registerLocale('ja', ja);

// ==========================================
// ドラッグ＆ドロップ ＆ プレビュー表示用コンポーネント
// ==========================================
function FileUploadArea({ files, onFilesChange, disabled }) {
    const [isDragOver, setIsDragOver] = useState(false);
    const [previews, setPreviews] = useState([]);
    const [isCompressing, setIsCompressing] = useState(false);
    const fileInputRef = useRef(null);

    const processFiles = async (inputFiles) => {
        setIsCompressing(true);

        const compressionOptions = {
            maxSizeMB: 1,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
            fileType: 'image/webp'
        };

        const processedFiles = await Promise.all(
            inputFiles.map(async (file) => {
                if (!file.type || !file.type.startsWith('image/')) {
                    return file;
                }

                try {
                    const compressed = await imageCompression(file, compressionOptions);
                    const newFileName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
                    return new File([compressed], newFileName, { type: 'image/webp' });
                } catch (error) {
                    console.warn(`画像「${file.name}」の圧縮に失敗したため、元のファイルを使用します:`, error);
                    return file;
                }
            })
        );

        setIsCompressing(false);
        return processedFiles;
    };

    useEffect(() => {
        const newPreviews = files.map((file) => {
            if (file.type && file.type.startsWith('image/')) {
                return {
                    file,
                    url: URL.createObjectURL(file),
                    isImage: true,
                };
            }
            return { file, url: null, isImage: false };
        });

        setPreviews(newPreviews);

        return () => {
            newPreviews.forEach((item) => {
                if (item.url) URL.revokeObjectURL(item.url);
            });
        };
    }, [files]);

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isCompressing && !disabled) setIsDragOver(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        if (isCompressing || disabled) return;

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const droppedFiles = Array.from(e.dataTransfer.files);
            const compressedFiles = await processFiles(droppedFiles);
            onFilesChange([...files, ...compressedFiles]);
            e.dataTransfer.clearData();
        }
    };

    const handleFileSelect = async (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const selectedFiles = Array.from(e.target.files);
            const compressedFiles = await processFiles(selectedFiles);
            onFilesChange([...files, ...compressedFiles]);
            e.target.value = '';
        }
    };

    const handleRemoveFile = (indexToRemove) => {
        const updated = files.filter((_, index) => index !== indexToRemove);
        onFilesChange(updated);
    };

    return (
        <div className="file-upload-wrapper">
            <div
                className={`file-upload-area ${isDragOver ? 'drag-over' : ''} ${isCompressing ? 'compressing' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !isCompressing && !disabled && fileInputRef.current?.click()}
                style={{
                    opacity: isCompressing || disabled ? 0.6 : 1,
                    cursor: isCompressing || disabled ? 'not-allowed' : 'pointer'
                }}
            >
                <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,.xlsx,.docx,.zip"
                    ref={fileInputRef}
                    className="hidden-file-input"
                    onChange={handleFileSelect}
                    disabled={isCompressing || disabled}
                />
                <div className="file-label">
                    <span className="upload-icon">{isCompressing ? '⏳' : '📎'}</span>
                    <div>
                        <strong>{isCompressing ? '画像を自動圧縮・最適化中...' : 'ファイルをドラッグ＆ドロップ'}</strong>
                        <p>{isCompressing ? 'しばらくお待ちください' : 'またはクリックして選択 (写真, PDF, Excel, Word, ZIP 等 / 画像は自動最適化されます)'}</p>
                    </div>
                </div>
            </div>

            {previews.length > 0 && (
                <div className="preview-grid">
                    {previews.map((item, index) => (
                        <div key={`${item.file.name}-${index}`} className="preview-card">
                            {item.isImage ? (
                                <img
                                    src={item.url}
                                    alt={item.file.name}
                                    className="preview-thumbnail"
                                    loading="lazy"
                                />
                            ) : (
                                <div className="preview-file-icon">📄</div>
                            )}
                            <div className="preview-info">
                                <span className="preview-filename">{item.file.name}</span>
                                <span className="preview-filesize">
                                    {(item.file.size / (1024 * 1024)).toFixed(2)} MB
                                </span>
                            </div>
                            <button
                                type="button"
                                className="btn-remove-file"
                                title="削除"
                                disabled={isCompressing || disabled}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveFile(index);
                                }}
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ==========================================
// メインコンポーネント
// ==========================================
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
        description: '',
        status: ''
    });
    const [editLoading, setEditLoading] = useState(false);

    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [listLoading, setListLoading] = useState(false);
    const [geoLoading, setGeoLoading] = useState(false);
    const [exportLoading, setExportLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const cachedMuniDataRef = useRef(null);

    useEffect(() => {
        if (message.text) {
            const timer = setTimeout(() => setMessage({ type: '', text: '' }), 5000);
            return () => clearTimeout(timer);
        }
    }, [message]);

    const fetchReports = useCallback(async (currentFilters = filters) => {
        if (!token) return;
        setListLoading(true);
        try {
            const params = {};
            Object.entries(currentFilters).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') params[key] = value;
            });
            const res = await api.get('/reports/', { params });
            setReports(Array.isArray(res.data) ? res.data : res.data.results || []);
        } catch (err) {
            console.error('報告一覧の取得に失敗しました:', err);
        } finally {
            setListLoading(false);
        }
    }, [token, filters]);

    useEffect(() => {
        fetchReports(filters);
    }, [token, filters, fetchReports]);

    const handleSearch = (newFilters) => setFilters(newFilters);
    const handleReset = () => setFilters({});

    // ------------------------------------------
    // 添付ファイルダウンロード
    // ------------------------------------------
    const handleDownloadAttachment = async (attachmentId) => {
        const newTab = window.open('about:blank', '_blank');
        try {
            const res = await api.get(`/attachments/${attachmentId}/download/`);
            if (res.data.download_url) {
                if (newTab) newTab.location.href = res.data.download_url;
                else window.location.href = res.data.download_url;
            } else {
                if (newTab) newTab.close();
                alert('ダウンロードURLの取得に失敗しました。');
            }
        } catch (err) {
            console.error('ダウンロードURL取得エラー:', err);
            if (newTab) newTab.close();
            alert('ファイルのダウンロードに失敗しました。');
        }
    };

    // ------------------------------------------
    // PDF 出力 (個別報告書)
    // ------------------------------------------
    const handleExportPDF = async (reportId) => {
        const newTab = window.open('about:blank', '_blank');
        try {
            // バックエンドからPDFのバイナリ(Blob)を受け取る場合
            const res = await api.get(`/reports/${reportId}/export_pdf/`, {
                responseType: 'blob'
            });

            const blob = new Blob([res.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);

            if (newTab) {
                newTab.location.href = url;
            } else {
                window.open(url, '_blank');
            }
        } catch (err) {
            console.error('PDF出力エラー:', err);
            if (newTab) newTab.close();
            alert('PDFの出力に失敗しました。');
        }
    };

    // ------------------------------------------
    // CSV 出力 (一覧データ)
    // ------------------------------------------
    const handleExportCSV = async () => {
        setExportLoading(true);
        try {
            const params = {};
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') params[key] = value;
            });

            const res = await api.get('/reports/export_csv/', {
                params,
                responseType: 'blob'
            });

            // Blobデータからファイルダウンロード処理を実行
            const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const dateStr = new Date().toISOString().split('T')[0];
            link.setAttribute('download', `reports_${dateStr}.csv`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);

            setMessage({ type: 'success', text: 'CSVファイルをダウンロードしました。' });
        } catch (err) {
            console.error('CSV出力エラー:', err);
            alert('CSVの出力に失敗しました。');
        } finally {
            setExportLoading(false);
        }
    };

    const handleInputChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
    const handleEditInputChange = (e) => setEditFormData({ ...editFormData, [e.target.name]: e.target.value });

    const handleStartEdit = (report) => {
        setEditingReport(report);
        setEditFormData({
            report_no: report.report_no || '',
            reception_no: report.reception_no || '',
            date: report.date || '',
            title: report.title || '',
            address: report.address || '',
            description: report.description || '',
            status: report.status || 'Draft'
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
        if (cachedMuniDataRef.current) return cachedMuniDataRef.current;
        try {
            const localData = localStorage.getItem('muni_map_cache');
            if (localData) {
                const parsed = JSON.parse(localData);
                cachedMuniDataRef.current = parsed;
                return parsed;
            }
        } catch (e) {
            console.warn('localStorage からの取得に失敗しました:', e);
        }

        try {
            const response = await fetch('/muni.json');
            if (!response.ok) throw new Error('muni.json の取得に失敗しました');

            const data = await response.json();
            cachedMuniDataRef.current = data;
            try {
                localStorage.setItem('muni_map_cache', JSON.stringify(data));
            } catch (e) {
                console.warn('localStorage への保存容量を超過した可能性があります:', e);
            }
            return data;
        } catch (error) {
            console.error('muni.json フェッチエラー:', error);
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
                    const muniData = await fetchMuniMap();
                    let muniCd = null;
                    let lv01Nm = '';

                    try {
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 3000);

                        const gsiRes = await fetch(
                            `https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?lon=${longitude}&lat=${latitude}`,
                            { signal: controller.signal }
                        );
                        clearTimeout(timeoutId);

                        if (gsiRes.ok) {
                            const data = await gsiRes.json();
                            if (data && data.results) {
                                muniCd = data.results.muniCd;
                                lv01Nm = data.results.lv01Nm || '';
                            }
                        }
                    } catch (e) {
                        console.warn('国土地理院APIからの取得に失敗またはタイムアウトしました。');
                    }

                    let fullAddress = '';
                    if (muniData && muniCd) {
                        const key = muniCd.replace(/^0+/, '');
                        const targetInfo = muniData[key] || muniData[muniCd];

                        if (targetInfo) {
                            const parts = targetInfo.split(',');
                            const prefName = parts[1] || '';
                            const muniName = (parts[3] || '').replace(/\s+/g, '');
                            fullAddress = `${prefName}${muniName}${lv01Nm}`;
                        }
                    }

                    if (!fullAddress && lv01Nm) fullAddress = lv01Nm;

                    if (fullAddress) {
                        setFormData((prev) => ({ ...prev, address: fullAddress }));
                        setMessage({ type: 'success', text: '住所を自動入力しました。' });
                    } else {
                        alert('住所情報の取得に失敗しました。手動で入力してください。');
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
                alert('位置情報が取得できませんでした。ブラウザの位置情報許可をご確認ください。');
            },
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
        );
    };

    const handleSubmit = async (targetStatus) => {
        if (!formData.report_no.trim() || !formData.reception_no.trim() || !formData.title.trim() || !formData.description.trim()) {
            alert('必須項目（報告日付、件名番号、受付番号、件名、業務内容）をすべて入力してください。');
            return;
        }

        setLoading(true);
        try {
            const payload = { ...formData, status: targetStatus };
            const reportRes = await api.post('/reports/', payload);
            const reportId = reportRes.data.id;

            if (files.length > 0) {
                const uploadData = new FormData();
                files.forEach((file) => uploadData.append('files', file));
                await api.post(`/reports/${reportId}/bulk_upload/`, uploadData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }

            const successMsg = targetStatus === 'Draft'
                ? '業務報告を「下書き」として保存しました。'
                : '業務報告を提出（承認申請）しました。';

            setMessage({ type: 'success', text: successMsg });
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
            console.error('送信エラー:', err);
            setMessage({ type: 'error', text: '登録エラーが発生しました: ' + (err.response?.data?.detail || '入力内容を確認してください。') });
        } finally {
            setLoading(false);
        }
    };

    const renderStatusBadge = (status) => {
        switch (status) {
            case 'Draft':
                return <span className="status-badge draft" style={{ backgroundColor: '#64748b', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }}>下書き</span>;
            case 'Pending':
                return <span className="status-badge pending" style={{ backgroundColor: '#f59e0b', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }}>承認待ち</span>;
            case 'Approved':
                return <span className="status-badge approved" style={{ backgroundColor: '#10b981', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }}>承認済み</span>;
            case 'Rejected':
                return <span className="status-badge rejected" style={{ backgroundColor: '#ef4444', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }}>差戻し</span>;
            default:
                return null;
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
                    <form onSubmit={(e) => e.preventDefault()} className="report-form">
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
                                    disabled={loading}
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
                                    disabled={loading}
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
                                    disabled={loading}
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
                                    disabled={loading}
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
                                        disabled={geoLoading || loading}
                                        className="btn-outline"
                                        style={{ padding: '2px 8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    >
                                        {geoLoading ? (
                                            <>
                                                <Spinner size={14} />
                                                <span>位置情報取得中...</span>
                                            </>
                                        ) : (
                                            '📍 現在地から自動入力'
                                        )}
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    name="address"
                                    placeholder="例: 東京都千代田区霞が関3-1-1"
                                    value={formData.address}
                                    onChange={handleInputChange}
                                    disabled={loading}
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
                                disabled={loading}
                            />
                        </div>

                        <div className="input-field">
                            <label>添付ファイル</label>
                            <FileUploadArea
                                files={files}
                                onFilesChange={setFiles}
                                disabled={loading}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                            <button
                                type="button"
                                disabled={loading}
                                onClick={() => handleSubmit('Draft')}
                                className="btn-outline"
                                style={{ flex: 1, padding: '12px', fontWeight: 'bold' }}
                            >
                                下書き保存
                            </button>

                            <button
                                type="button"
                                disabled={loading}
                                onClick={() => handleSubmit('Pending')}
                                className="btn-glow submit-btn"
                                style={{ flex: 1, padding: '12px', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                            >
                                {loading ? (
                                    <>
                                        <Spinner size={18} />
                                        <span>送信中...</span>
                                    </>
                                ) : (
                                    '報告を提出（承認申請）'
                                )}
                            </button>
                        </div>
                    </form>
                </section>

                <section className="card list-section glass-panel">
                    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2>登録済み報告一覧 ({reports.length} 件)</h2>
                        <button
                            type="button"
                            onClick={handleExportCSV}
                            disabled={exportLoading || reports.length === 0}
                            className="btn-outline"
                            style={{ padding: '6px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                            {exportLoading ? <Spinner size={14} /> : '📊 CSV出力'}
                        </button>
                    </div>
                    <ReportFilterBar onSearch={handleSearch} onReset={handleReset} />
                    <div className="reports-scroll">
                        {listLoading ? (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px' }}>
                                <Spinner size={32} />
                            </div>
                        ) : reports.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>
                                該当する報告データがありません。
                            </div>
                        ) : (
                            reports.map(r => (
                                <div key={r.id} className="report-card-item">
                                    <div className="item-top">
                                        <div className="tags" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                            <span className="tag-no">No. {r.report_no}</span>
                                            <span className="tag-rec">受付: {r.reception_no}</span>
                                            {renderStatusBadge(r.status)}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span className="item-date">{r.date}</span>
                                            <button type="button" onClick={() => handleExportPDF(r.id)} className="btn-outline" style={{ padding: '2px 8px', fontSize: '12px' }}>📄 PDF</button>
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
                                                    <button
                                                        key={att.id}
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDownloadAttachment(att.id);
                                                        }}
                                                        className="attachment-chip"
                                                    >
                                                        📎 {att.original_filename}
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
                            <div className="form-row">
                                <div className="input-field full-width">
                                    <label>ステータス</label>
                                    <select name="status" value={editFormData.status} onChange={handleEditInputChange} style={{ width: '100%', padding: '8px', borderRadius: '4px', background: '#0f172a', color: '#fff', border: '1px solid #334155' }}>
                                        <option value="Draft">下書き</option>
                                        <option value="Pending">承認待ち (提出)</option>
                                        <option value="Approved">承認済み</option>
                                        <option value="Rejected">差戻し</option>
                                    </select>
                                </div>
                            </div>
                            <div className="input-field full-width"><label>件名 *</label><input type="text" name="title" value={editFormData.title} onChange={handleEditInputChange} required /></div>
                            <div className="input-field full-width"><label>住所</label><input type="text" name="address" value={editFormData.address} onChange={handleEditInputChange} /></div>
                            <div className="input-field"><label>詳細 *</label><textarea name="description" rows="4" value={editFormData.description} onChange={handleEditInputChange} required /></div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
                                <button type="button" onClick={() => setEditingReport(null)} className="btn-outline">キャンセル</button>
                                <button type="submit" disabled={editLoading} className="btn-glow" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {editLoading ? (
                                        <>
                                            <Spinner size={14} />
                                            <span>更新中...</span>
                                        </>
                                    ) : (
                                        '保存'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}