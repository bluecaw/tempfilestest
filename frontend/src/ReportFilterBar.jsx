// src/ReportFilterBar.jsx
import React, { useState } from 'react';

export const ReportFilterBar = ({ onSearch, onReset }) => {
    const [search, setSearch] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const handleSearch = (e) => {
        e.preventDefault();
        onSearch({
            search,
            start_date: startDate,
            end_date: endDate,
        });
    };

    const handleReset = () => {
        setSearch('');
        setStartDate('');
        setEndDate('');
        onReset();
    };

    return (
        <form onSubmit={handleSearch} style={styles.container}>
            <div style={styles.field}>
                <label style={styles.label}>キーワード検索</label>
                <input
                    type="text"
                    placeholder="件名、内容、件名/受付番号、住所"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={styles.input}
                />
            </div>

            <div style={styles.field}>
                <label style={styles.label}>開始日</label>
                <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={styles.input}
                />
            </div>

            <div style={styles.field}>
                <label style={styles.label}>終了日</label>
                <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={styles.input}
                />
            </div>

            <div style={styles.buttonGroup}>
                <button type="submit" style={{ ...styles.button, ...styles.searchBtn }}>
                    検索
                </button>
                <button
                    type="button"
                    onClick={handleReset}
                    style={{ ...styles.button, ...styles.resetBtn }}
                >
                    クリア
                </button>
            </div>
        </form>
    );
};

const styles = {
    container: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        alignItems: 'flex-end',
        marginBottom: '20px',
        padding: '16px',
        // ★ 周りのUIに合わせたダーク透過背景と枠線に変更
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(8px)',
    },
    field: {
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 180px',
    },
    label: {
        fontSize: '12px',
        marginBottom: '6px',
        fontWeight: 'bold',
        // ★ 文字色を白系に調整
        color: '#94a3b8',
    },
    input: {
        padding: '8px 12px',
        // ★ 入力欄背景を暗くし、テキスト色・枠線を白系へ変更
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: '6px',
        fontSize: '14px',
        color: '#ffffff',
        outline: 'none',
    },
    buttonGroup: {
        display: 'flex',
        gap: '8px',
    },
    button: {
        padding: '9px 18px',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 'bold',
        transition: 'all 0.2s ease',
    },
    searchBtn: {
        backgroundColor: '#2563eb',
        color: '#ffffff',
        boxShadow: '0 0 10px rgba(37, 99, 235, 0.4)',
    },
    resetBtn: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        color: '#cbd5e1',
        border: '1px solid rgba(255, 255, 255, 0.15)',
    },
};