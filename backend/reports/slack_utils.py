# backend/reports/slack_utils.py (新規作成)
import requests
import json

def send_slack_interactive_notification(webhook_url, report):
    """
    承認・差し戻しボタンがついたSlackメッセージを送信
    """
    payload = {
        "blocks": [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"📢 *【承認申請】新しい日報が提出されました*\n*件名:* {report.title}\n*提出者:* {report.created_by.username if report.created_by else '未設定'}\n*日付:* {report.date}"
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"```{report.description[:100]}...```"  # 本文の冒頭を表示
                }
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "承認する"},
                        "style": "primary",
                        "action_id": "approve_report",
                        "value": str(report.id)  # ReportのIDを埋め込む
                    },
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "差し戻す"},
                        "style": "danger",
                        "action_id": "reject_report",
                        "value": str(report.id)  # ReportのIDを埋め込む
                    }
                ]
            }
        ]
    }

    try:
        response = requests.post(
            webhook_url,
            data=json.dumps(payload),
            headers={"Content-Type": "application/json"},
            timeout=5
        )
        response.raise_for_status()
    except Exception as e:
        print(f"Slack Notification Failed: {e}")