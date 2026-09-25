import React, { useState, useEffect, useRef } from 'react';

export default function FileUploadArea({ files, onFilesChange }) {
    const [isDragOver, setIsDragOver] = useState(false);
    const [previews, setPreviews] = useState([]);
    const fileInputRef = useRef(null);

    // ファイルリストが変わるたびにプレビューURLを生成し、古いメモリを解放する
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

        // クリーンアップ関数（不要になったBlob URLメモリを解放）
        return () => {
            newPreviews.forEach((item) => {
                if (item.url) URL.revokeObjectURL(item.url);
            });
        };
    }, [files]);

    // ドラッグ操作関連のイベントハンドラー
    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const droppedFiles = Array.from(e.dataTransfer.files);
            onFilesChange([...files, ...droppedFiles]);
            e.dataTransfer.clearData();
        }
    };

    // ファイルダイアログ選択時
    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const selectedFiles = Array.from(e.target.files);
            onFilesChange([...files, ...selectedFiles]);
        }
    };

    // 個別ファイルの削除
    const handleRemoveFile = (indexToRemove) => {
        const updated = files.filter((_, index) => index !== indexToRemove);
        onFilesChange(updated);
    };

    return (
        <div className="file-upload-wrapper">
            {/* ドロップ可能エリア */}
            <div
                className={`file-upload-area ${isDragOver ? 'drag-over' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
            >
                <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/gif,application/pdf"
                    ref={fileInputRef}
                    className="hidden-file-input"
                    onChange={handleFileSelect}
                />
                <div className="file-label">
                    <span className="upload-icon">📁</span>
                    <div>
                        <strong>ファイルをドラッグ＆ドロップ</strong>
                        <p>またはクリックして選択 (JPG, PNG, PDFなど)</p>
                    </div>
                </div>
            </div>

            {/* サムネイル画像・ファイル一覧表示エリア */}
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
                                onClick={(e) => {
                                    e.stopPropagation(); // 親のクリック（ファイル選択ダイアログ）を抑制
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