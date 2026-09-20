import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
    baseURL: API_BASE,
});

// Request Interceptor: リクエスト送信時に自動的に Authorization ヘッダーを付与
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('jwt_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response Interceptor: 401エラー（トークン期限切れ等）を自動検知して処理
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            // ローカルストレージのトークンを削除
            localStorage.removeItem('jwt_token');

            // ログイン画面へ強制遷移（ページリロード）
            // ※ React Router 等を使っている場合はカスタムイベントやステート更新で制御も可能です
            if (window.location.pathname !== '/login') {
                window.location.reload();
            }
        }
        return Promise.reject(error);
    }
);

export default api;