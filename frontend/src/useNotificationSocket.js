// useNotificationSocket.js
import { useEffect, useRef, useState, useCallback } from 'react';

export const useNotificationSocket = (token) => {
    const [notifications, setNotifications] = useState([]);
    const [latestNotification, setLatestNotification] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef(null);

    const connect = useCallback(() => {
        if (!token) return;

        const wsScheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const host = import.meta.env.VITE_WS_URL || 'localhost:8000';
        const wsUrl = `${wsScheme}://${host}/ws/notifications/?token=${token}`;

        const socket = new WebSocket(wsUrl);
        socketRef.current = socket;

        socket.onopen = () => {
            console.log('WebSocket Connected');
            setIsConnected(true);
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log("WebSocketメッセージ受信成功:", data);

                setLatestNotification(data);
                setNotifications((prev) => [data, ...prev]);
            } catch (err) {
                console.error('Failed to parse WS message:', err);
            }
        };

        socket.onerror = (error) => {
            console.error('WebSocket Error:', error);
        };

        socket.onclose = (event) => {
            console.log('WebSocket Closed:', event.reason);
            setIsConnected(false);

            if (!event.wasClean) {
                setTimeout(() => {
                    connect();
                }, 3000);
            }
        };
    }, [token]);

    useEffect(() => {
        connect();

        return () => {
            if (socketRef.current) {
                socketRef.current.close();
            }
        };
    }, [connect]);

    return {
        notifications,
        latestNotification,
        isConnected,
    };
};