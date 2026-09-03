const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const DEPLOYMENT_ID = 'AKfycbx_kDAFAovruLFBQnxLAKie3raxP2IzL1HM9HWZXoB1hkbw6ouWlzlXxPJ49DrV0f8o';
const clasprcPath = path.join(os.homedir(), '.clasprc.json');

function autoDeploy() {
  console.log('🚀 [TOOLHUNT AUTO-DEPLOY] Bắt đầu tự động cập nhật Google Apps Script...');

  if (!fs.existsSync(clasprcPath)) {
    console.error('❌ Chưa tìm thấy thông tin xác thực Clasp (~/.clasprc.json).');
    console.log('👉 Vui lòng hoàn tất xác thực đăng nhập Clasp 1 lần duy nhất.');
    process.exit(1);
  }

  try {
    console.log('📤 1. Đang đẩy mã nguồn mới lên Google Apps Script (clasp push)...');
    const pushOutput = execSync('npx clasp push --force', { encoding: 'utf8' });
    console.log(pushOutput.trim());

    console.log(`🚀 2. Đang tự động triển khai phiên bản mới cho Deployment ID: ${DEPLOYMENT_ID}...`);
    const desc = `Auto-deployed update: ${new Date().toLocaleString('vi-VN')}`;
    const deployOutput = execSync(`npx clasp deploy -i "${DEPLOYMENT_ID}" -d "${desc}"`, { encoding: 'utf8' });
    console.log(deployOutput.trim());

    console.log('✅ HOÀN TẤT: Mã nguồn đã được tự động đẩy lên và triển khai thành công!');
  } catch (err) {
    console.error('❌ Lỗi trong quá trình auto-deploy:', err.message);
    if (err.stdout) console.log('Stdout:', err.stdout);
    if (err.stderr) console.log('Stderr:', err.stderr);
    process.exit(1);
  }
}

autoDeploy();
