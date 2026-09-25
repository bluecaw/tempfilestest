// src/ReportFilterBar.jsx
import React, { useState } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import ja from 'date-fns/locale/ja';
import 'react-datepicker/dist/react-datepicker.css';

// 日本語化設定
registerLocale('ja', ja);

export const ReportFilterBar = ({ onSearch, onReset }) => {
    const [search, setSearch] = useState('');
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);

    // Dateオブジェクトを YYYY-MM-DD 形式の文字列に変換するヘルパー関数
    const formatDate = (date) => {
        if (!date) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const handleSearch = (e) => {
        e.preventDefault();
        onSearch({
            search,
            start_date: formatDate(startDate),
            end_date: formatDate(endDate),
        });
    };

    const handleReset = () => {
        setSearch('');
        setStartDate(null);
        setEndDate(null);
        onReset();
    };

    return (
        <form onSubmit={handleSearch} style={styles.container}>
            {/* 組み込みスタイル：ダークモード対応CSS */}
            <style>{`
        .custom-datepicker {
          width: 100%;
          padding: 8px 12px;
          background-color: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 6px;
          font-size: 14px;
          color: #ffffff;
          outline: none;
          box-sizing: border-box;
          cursor: pointer;
        }
        .custom-datepicker:focus {
          border-color: #2563eb;
        }
        /* ポップアップカレンダーのダークモードカスタマイズ */
        .react-datepicker {
          background-color: #1e293b !important;
          border-color: rgba(255, 255, 255, 0.2) !important;
          font-family: inherit;
        }
        .react-datepicker__header {
          background-color: #0f172a !important;
          border-bottom-color: rgba(255, 255, 255, 0.1) !important;
        }
        .react-datepicker__current-month,
        .react-datepicker-time__header,
        .react-datepicker-year-header,
        .react-datepicker__day-name {
          color: #f8fafc !important;
        }
        .react-datepicker__day {
          color: #cbd5e1 !important;
        }
        .react-datepicker__day:hover {
          background-color: #334155 !important;
          color: #fff !important;
        }
        .react-datepicker__day--selected,
        .react-datepicker__day--keyboard-selected {
          background-color: #2563eb !important;
          color: #fff !important;
        }
        .react-datepicker__triangle {
          display: none !important;
        }
      `}</style>

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
                <DatePicker
                    selected={startDate}
                    onChange={(date) => setStartDate(date)}
                    dateFormat="yyyy/MM/dd"
                    locale="ja"
                    placeholderText="年/月/日を選択"
                    className="custom-datepicker"
                    isClearable
                />
            </div>

            <div style={styles.field}>
                <label style={styles.label}>終了日</label>
                <DatePicker
                    selected={endDate}
                    onChange={(date) => setEndDate(date)}
                    dateFormat="yyyy/MM/dd"
                    locale="ja"
                    placeholderText="年/月/日を選択"
                    className="custom-datepicker"
                    isClearable
                    minDate={startDate}
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
        color: '#94a3b8',
    },
    input: {
        padding: '8px 12px',
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: '6px',
        fontSize: '14px',
        color: '#ffffff',
        outline: 'none',
        boxSizing: 'border-box',
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