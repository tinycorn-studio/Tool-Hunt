#!/usr/bin/env node

/**
 * ==============================================================================
 * CLI TOOL: CÀI ĐẶT VÀ KIỂM TRA TELEGRAM WEBHOOK
 * ==============================================================================
 * Sử dụng:
 *   node scripts/setup_webhook.js --token=<BOT_TOKEN> --url=<WEBHOOK_URL>
 * hoặc chạy tương tác:
 *   node scripts/setup_webhook.js
 * ==============================================================================
 */

const https = require('https');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function prompt(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

function requestTelegram(token, method, payload = null) {
  return new Promise((resolve, reject) => {
    const data = payload ? JSON.stringify(payload) : null;
    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${token}/${method}`,
      method: payload ? 'POST' : 'GET',
      headers: payload ? {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      } : {}
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ ok: false, error: body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log('\n======================================================');
  console.log('🤖 TOOLHUNT ENTERPRISE - CÔNG CỤ CÀI ĐẶT WEBHOOK');
  console.log('======================================================\n');

  // Lấy arguments từ CLI nếu có
  const args = process.argv.slice(2);
  let token = "";
  let url = "";

  args.forEach(arg => {
    if (arg.startsWith('--token=')) token = arg.split('=')[1];
    if (arg.startsWith('--url=')) url = arg.split('=')[1];
  });

  if (!token) {
    token = await prompt('🔑 1. Nhập Bot Token từ @BotFather: ');
    token = token.trim();
  }

  if (!token) {
    console.error('❌ Lỗi: Bot Token không được để trống!');
    rl.close();
    return;
  }

  // 1. Kiểm tra Bot
  console.log('\n⏳ Đang kiểm tra thông tin Bot...');
  const meRes = await requestTelegram(token, 'getMe');
  if (!meRes.ok) {
    console.error('❌ Bot Token không hợp lệ!', meRes.description || meRes);
    rl.close();
    return;
  }

  const bot = meRes.result;
  console.log(`✅ Kết nối thành công tới Bot: ${bot.first_name} (@${bot.username}) [ID: ${bot.id}]`);

  // 2. Kiểm tra Webhook hiện tại
  console.log('\n⏳ Đang kiểm tra trạng thái Webhook hiện tại...');
  const hookInfo = await requestTelegram(token, 'getWebhookInfo');
  if (hookInfo.ok) {
    console.log(`📌 Webhook URL hiện tại: ${hookInfo.result.url || '(Chưa cài đặt)'}`);
    if (hookInfo.result.pending_update_count > 0) {
      console.log(`⚠️ Số tin nhắn đang chờ xử lý: ${hookInfo.result.pending_update_count}`);
    }
    if (hookInfo.result.last_error_message) {
      console.log(`⚠️ Lỗi Webhook gần nhất: ${hookInfo.result.last_error_message}`);
    }
  }

  // 3. Tùy chọn cài đặt
  console.log('\n------------------------------------------------------');
  console.log('LỰA CHỌN THAO TÁC:');
  console.log('1. Đăng ký Webhook mới (Gán link Google Apps Script)');
  console.log('2. Xóa Webhook (Chuyển về chế độ Long Polling)');
  console.log('3. Thoát');
  console.log('------------------------------------------------------');

  const choice = await prompt('👉 Chọn (1/2/3): ');

  if (choice.trim() === '1') {
    if (!url) {
      url = await prompt('\n🔗 Nhập URL Google Apps Script Web App (https://script.google.com/.../exec): ');
      url = url.trim();
    }

    if (!url || !url.startsWith('https://')) {
      console.error('❌ URL không hợp lệ! Bắt buộc phải là HTTPS.');
    } else {
      console.log('\n⏳ Đang gửi yêu cầu cài đặt Webhook tới Telegram...');
      const setRes = await requestTelegram(token, 'setWebhook', {
        url: url,
        allowed_updates: ["message", "callback_query"]
      });

      if (setRes.ok) {
        console.log('\n🎉 THÀNH CÔNG RỰC RỠ!');
        console.log(`✅ ${setRes.description}`);
        console.log(`🔗 Webhook URL: ${url}`);
        console.log('\n👉 Bây giờ bạn có thể vào nhóm Telegram và gõ /idea để test bot!');
      } else {
        console.error('❌ Cài đặt Webhook thất bại:', setRes.description);
      }
    }
  } else if (choice.trim() === '2') {
    console.log('\n⏳ Đang xóa Webhook...');
    const delRes = await requestTelegram(token, 'deleteWebhook', { drop_pending_updates: true });
    if (delRes.ok) {
      console.log('✅ Đã xóa Webhook thành công!');
    } else {
      console.error('❌ Lỗi khi xóa Webhook:', delRes.description);
    }
  } else {
    console.log('Đã thoát.');
  }

  rl.close();
}

main().catch(err => {
  console.error('Lỗi không xác định:', err);
  rl.close();
});
