# backend/reports/consumers.py
import json
from channels.generic.websocket import AsyncWebsocketConsumer

class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        try:
            self.user = self.scope.get("user")

            # 認証されていないユーザーは接続を拒否
            if not self.user or self.user.is_anonymous:
                print("WebSocket Connect Failed: Anonymous User")
                await self.close()
                return

            # グループ名の決定
            self.user_group_name = f"user_{self.user.id}"
            self.all_group_name = "notifications_all"

            # ★重要: 先に WebSocket 接続を確定（accept）させてタイムアウトを防ぐ
            await self.accept()
            print(f"WebSocket Connected: user_{self.user.id}")

            # 接続確定後に Redis のグループへ参加
            await self.channel_layer.group_add(
                self.user_group_name,
                self.channel_name
            )
            await self.channel_layer.group_add(
                self.all_group_name,
                self.channel_name
            )

        except Exception as e:
            print(f"WebSocket Connect Error: {e}")
            await self.close()

    async def disconnect(self, close_code):
        try:
            if hasattr(self, 'user_group_name'):
                await self.channel_layer.group_discard(
                    self.user_group_name,
                    self.channel_name
                )
            if hasattr(self, 'all_group_name'):
                await self.channel_layer.group_discard(
                    self.all_group_name,
                    self.channel_name
                )
        except Exception as e:
            print(f"WebSocket Disconnect Error: {e}")

    # クライアントからの Ping (Keep-Alive) 受信処理
    async def receive(self, text_data=None, bytes_data=None):
        if text_data:
            try:
                data = json.loads(text_data)
                if data.get("type") == "ping":
                    await self.send(text_data=json.dumps({"type": "pong"}))
            except Exception as e:
                print(f"WebSocket Receive Error: {e}")

    # 通知送出処理
    async def send_notification(self, event):
        try:
            message_data = event.get('message', {})
            
            if isinstance(message_data, dict):
                payload = {
                    'notification_type': message_data.get('notification_type', event.get('notification_type')),
                    'message': message_data.get('message', event.get('message')),
                    'report_id': message_data.get('report_id', event.get('report_id')),
                    'created_at': message_data.get('created_at', event.get('created_at')),
                }
            else:
                payload = {
                    'notification_type': event.get('notification_type'),
                    'message': event.get('message'),
                    'report_id': event.get('report_id'),
                    'created_at': event.get('created_at'),
                }

            await self.send(text_data=json.dumps(payload))
        except Exception as e:
            print(f"WebSocket Send Notification Error: {e}")