// src/components/Spinner.jsx
import React from 'react';

export const Spinner = ({ size = 16, color = 'currentColor' }) => {
    return (
        <svg
            className="spinner-icon"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ marginRight: '6px' }}
        >
            {/* 背景の薄い円軌道 */}
            <circle
                cx="12"
                cy="12"
                r="10"
                stroke={color}
                strokeOpacity="0.25"
                strokeWidth="4"
            />
            {/* 回転して光る部分の円弧 */}
            <path
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                fill={color}
            />
        </svg>
    );
};