#!/usr/bin/env python3
"""
CLI Tool: Cài đặt và Kiểm tra Telegram Webhook bằng Python
"""

import sys
import json
import urllib.request
import urllib.parse
import urllib.error

def request_telegram(token: str, method: str, payload: dict = None):
    url = f"https://api.telegram.org/bot{token}/{method}"
    headers = {"Content-Type": "application/json"}
    
    if payload:
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(url, data=data, headers=headers, method='POST')
    else:
        req = urllib.request.Request(url, headers=headers, method='GET')
        
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return json.loads(e.read().decode('utf-8'))
    except Exception as e:
        return {"ok": False, "description": str(e)}

def main():
    print("\n======================================================")
    print("🤖 TOOLHUNT ENTERPRISE - CÔNG CỤ CÀI ĐẶT WEBHOOK (PYTHON)")
    print("======================================================\n")

    token = input("🔑 1. Nhập Bot Token từ @BotFather: ").strip()
    if not token:
        print("❌ Lỗi: Bot Token không được để trống!")
        return

    # 1. Kiểm tra Bot
    print("\n⏳ Đang kiểm tra thông tin Bot...")
    me_res = request_telegram(token, "getMe")
    if not me_res.get("ok"):
        print(f"❌ Bot Token không hợp lệ: {me_res.get('description')}")
        return

    bot = me_res["result"]
    print(f"✅ Kết nối thành công: {bot.get('first_name')} (@{bot.get('username')}) [ID: {bot.get('id')}]")

    # 2. Kiểm tra Webhook hiện tại
    print("\n⏳ Đang kiểm tra trạng thái Webhook hiện tại...")
    hook_info = request_telegram(token, "getWebhookInfo")
    if hook_info.get("ok"):
        res = hook_info["result"]
        print(f"📌 Webhook URL hiện tại: {res.get('url') or '(Chưa cài đặt)'}")
        if res.get("pending_update_count", 0) > 0:
            print(f"⚠️ Tin nhắn đang chờ xử lý: {res.get('pending_update_count')}")
        if res.get("last_error_message"):
            print(f"⚠️ Lỗi gần nhất: {res.get('last_error_message')}")

    print("\n------------------------------------------------------")
    print("1. Đăng ký Webhook mới (Google Apps Script URL)")
    print("2. Xóa Webhook")
    print("3. Thoát")
    print("------------------------------------------------------")
    choice = input("👉 Chọn (1/2/3): ").strip()

    if choice == "1":
        webhook_url = input("\n🔗 Nhập URL Google Apps Script Web App: ").strip()
        if not webhook_url.startswith("https://"):
            print("❌ URL phải bắt đầu bằng HTTPS!")
            return
        
        print("\n⏳ Đang cài đặt Webhook...")
        set_res = request_telegram(token, "setWebhook", {
            "url": webhook_url,
            "allowed_updates": ["message", "callback_query"]
        })
        if set_res.get("ok"):
            print(f"\n🎉 THÀNH CÔNG: {set_res.get('description')}")
        else:
            print(f"❌ Thất bại: {set_res.get('description')}")
    elif choice == "2":
        del_res = request_telegram(token, "deleteWebhook", {"drop_pending_updates": True})
        if del_res.get("ok"):
            print("✅ Đã xóa Webhook thành công!")
        else:
            print(f"❌ Lỗi: {del_res.get('description')}")

if __name__ == "__main__":
    main()
