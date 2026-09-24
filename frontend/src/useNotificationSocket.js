// useNotificationSocket.js
import { useState, useEffect, useRef } from 'react';

export const useNotificationSocket = (token) => {
    const [notifications, setNotifications] = useState([]);
    const [latestNotification, setLatestNotification] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef(null);

    useEffect(() => {
        if (!token) return;

        // ★ 本番ドメインへの WebSocket URL を動的に決定
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

        // 環境変数 VITE_WS_URL があればそれを使用し、無ければ本番のRenderバックエンドURLをフォールバックとして使用
        const envWsUrl = import.meta.env.VITE_WS_URL;
        const defaultBackendHost = 'report-django-backend.onrender.com';

        const wsBaseUrl = envWsUrl || `${wsProtocol}//${defaultBackendHost}`;
        const socketUrl = `${wsBaseUrl}/ws/notifications/?token=${token}`;

        console.log(`Connecting to WebSocket: ${socketUrl}`);
        const socket = new WebSocket(socketUrl);
        socketRef.current = socket;

        socket.onopen = () => {
            console.log('WebSocket Connected');
            setIsConnected(true);
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                setLatestNotification(data);
                setNotifications((prev) => [data, ...prev]);
            } catch (e) {
                console.error('WebSocket Message Parse Error:', e);
            }
        };

        socket.onerror = (error) => {
            console.error('WebSocket Error:', error);
            setIsConnected(false);
        };

        socket.onclose = () => {
            console.log('WebSocket Disconnected');
            setIsConnected(false);
        };

        return () => {
            if (socket.readyState === 1) {
                socket.close();
            }
        };
    }, [token]);

    return { notifications, latestNotification, isConnected };
};