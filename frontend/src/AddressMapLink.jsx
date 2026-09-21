// components/AddressMapLink.jsx
import React from 'react';

const AddressMapLink = ({ address, latitude, longitude }) => {
    if (!address) return null;

    // 1. 座標が存在する場合は「座標ピン留めURL」
    // 2. 座標が存在しない場合は「住所検索URL」にフォールバック
    let mapUrl = '';
    if (latitude && longitude) {
        mapUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    } else {
        mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    }

    return (
        <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-blue-600 hover:text-blue-800 hover:underline gap-1 cursor-pointer font-medium"
            title="Googleマップを別タブで開く"
        >
            <span>📍 {address}</span>
            {/* 外部ページ遷移アイコン（SVG） */}
            <svg
                className="w-4 h-4 ml-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
            </svg>
        </a>
    );
};

export default AddressMapLink;