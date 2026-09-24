# backend/reports/utils.py
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.utils import timezone

def send_realtime_notification(user_id, notification_type, message, report_id=None):
    """
    指定した user_id の WebSocket グループにリアルタイム通知を送信する
    """
    channel_layer = get_channel_layer()
    if not channel_layer:
        return

    async_to_sync(channel_layer.group_send)(
        f"user_{user_id}",
        {
            "type": "send_notification",
            "notification_type": notification_type,
            "message": message,
            "report_id": report_id,
            "created_at": timezone.now().isoformat(),
        }
    )