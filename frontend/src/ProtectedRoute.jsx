// src/ProtectedRoute.jsx
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

export default function ProtectedRoute() {
    const token = localStorage.getItem('jwt_token');

    // トークンがなければログイン画面 (/login) へ転送
    if (!token) {
        return <Navigate to="/login" replace />;
    }

    // トークンがあれば配下のコンポーネントを表示
    return <Outlet />;
}