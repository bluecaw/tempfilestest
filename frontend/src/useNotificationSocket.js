// frontend/src/useNotificationSocket.js
import { useState, useEffect, useRef } from 'react';

export const useNotificationSocket = (token) => {
    const [notifications, setNotifications] = useState([]);
    const [latestNotification, setLatestNotification] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef(null);
    const pingIntervalRef = useRef(null); // ★ Ping用のタイマー保持

    useEffect(() => {
        if (!token) return;

        // WebSocket URL を動的に決定
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
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

            // ★ 25秒ごとに Ping メッセージを送信して接続を維持 (Upstash/Renderのタイムアウト防止)
            pingIntervalRef.current = setInterval(() => {
                if (socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({ type: 'ping' }));
                }
            }, 25000);
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                // ★ サーバーからの Pong 返答は通知リストに追加せずスキップ
                if (data.type === 'pong') return;

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

            // ★ 切断時に Ping タイマーを解除
            if (pingIntervalRef.current) {
                clearInterval(pingIntervalRef.current);
            }
        };

        return () => {
            // ★ コンポーネントアンマウント時のクリーンアップ
            if (pingIntervalRef.current) {
                clearInterval(pingIntervalRef.current);
            }
            if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
                socket.close();
            }
        };
    }, [token]);

    return { notifications, latestNotification, isConnected };
};