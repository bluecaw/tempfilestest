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

        # 1. ユーザー個人のグループ名を作成 (例: user_1)
        self.user_group_name = f"user_{self.user.id}"
        # 2. 全体通知用のグループ名を作成
        self.all_group_name = "notifications_all"

        # 個人グループに参加
        await self.channel_layer.group_add(
            self.user_group_name,
            self.channel_name
        )
        # 全体グループに参加
        await self.channel_layer.group_add(
            self.all_group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        # 個人グループから離脱
        if hasattr(self, 'user_group_name'):
            await self.channel_layer.group_discard(
                self.user_group_name,
                self.channel_name
            )
        # 全体グループから離脱
        if hasattr(self, 'all_group_name'):
            await self.channel_layer.group_discard(
                self.all_group_name,
                self.channel_name
            )

    # Djangoの別処理（viewsなど）から通知が飛ばされた時に呼ばれる
    async def send_notification(self, event):
        # views.py の送出形式に合わせて柔軟にデータをパース
        message_data = event.get('message', {})
        
        # dict形式で包まれている場合とフラットな場合の双方に対応
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