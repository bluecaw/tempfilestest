# backend/reports/consumers.py
import json
from channels.generic.websocket import AsyncWebsocketConsumer

class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"]

        # 認証されていないユーザーは接続を拒否
        if not self.user or self.user.is_anonymous:
            await self.close()
            return

        # ユーザーごとの通知グループ名を作成 (例: user_1)
        self.group_name = f"user_{self.user.id}"

        # チャンネルグループに参加
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )

    # Djangoの別処理（viewsなど）から通知が飛ばされた時に呼ばれる
    async def send_notification(self, event):
        await self.send(text_data=json.dumps({
            'notification_type': event.get('notification_type'),
            'message': event.get('message'),
            'report_id': event.get('report_id'),
            'created_at': event.get('created_at'),
        }))