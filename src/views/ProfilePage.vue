<script setup>
/**
 * ProfilePage.vue — 个人信息 & 修改密码
 */
import { ref, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import AppSidebar from '@/components/AppSidebar.vue'
import Logout from '@/components/Logout.vue'

const API_BASE = '/api/User'

const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}')
const userRoles = JSON.parse(localStorage.getItem('userRoles') || '[]')
const saving = ref(false)

// ============ 修改密码 ============
const pwdForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

function resetPwdForm() {
  pwdForm.oldPassword = ''
  pwdForm.newPassword = ''
  pwdForm.confirmPassword = ''
}

async function handleChangePassword() {
  if (!pwdForm.oldPassword) { ElMessage.warning('请输入原密码'); return }
  if (!pwdForm.newPassword) { ElMessage.warning('请输入新密码'); return }
  if (pwdForm.newPassword.length < 6) { ElMessage.warning('新密码至少6位'); return }
  if (pwdForm.newPassword !== pwdForm.confirmPassword) { ElMessage.warning('两次输入的新密码不一致'); return }

  saving.value = true
  try {
    const token = localStorage.getItem('token')
    const res = await fetch(`${API_BASE}/ChangePassword`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        oldPassword: pwdForm.oldPassword,
        newPassword: pwdForm.newPassword
      })
    })
    const text = await res.text()
    const result = text ? JSON.parse(text) : {}

    if (result.success || result.code === 200) {
      ElMessageBox.alert('密码修改成功，下次登录请使用新密码', '修改成功', {
        type: 'success',
        confirmButtonText: '知道了'
      })
      resetPwdForm()
      return
    }
    ElMessage.error(result.message || '修改失败')
  } catch {
    ElMessage.error('修改失败，后端不可用')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="layout">
    <AppSidebar />

    <div class="main">
      <div class="header">
        <h3>个人信息</h3>
        <Logout />
      </div>

      <div class="content">
        <!-- ==================== 用户信息头部 ==================== -->
        <div class="profile-header">
          <div class="avatar-ring">
            <div class="avatar">{{ (userInfo.userName || '?')[0] }}</div>
          </div>
          <div class="profile-meta">
            <h2 class="profile-name">{{ userInfo.userName || '未知用户' }}</h2>
            <div class="profile-tags">
              <el-tag v-for="role in userRoles" :key="role" size="small" effect="plain" style="margin-right:6px;">
                {{ role }}
              </el-tag>
            </div>
          </div>
        </div>

        <!-- ==================== 基本信息 ==================== -->
        <div class="section-card">
          <div class="section-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#409eff" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            基本信息
          </div>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">用户名称</span>
              <span class="info-value">{{ userInfo.userName || '—' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">登录账号</span>
              <span class="info-value">{{ userInfo.userCode || userInfo.userName || '—' }}</span>
            </div>
          </div>
        </div>

        <!-- ==================== 修改密码 ==================== -->
        <div class="section-card">
          <div class="section-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#409eff" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            修改密码
          </div>
          <el-form :model="pwdForm" label-position="top" class="pwd-form">
            <el-form-item label="原密码" required>
              <el-input v-model="pwdForm.oldPassword" type="password" show-password placeholder="请输入原密码" />
            </el-form-item>
            <el-form-item label="新密码" required>
              <el-input v-model="pwdForm.newPassword" type="password" show-password placeholder="至少6位，请妥善保管" />
            </el-form-item>
            <el-form-item label="确认新密码" required>
              <el-input v-model="pwdForm.confirmPassword" type="password" show-password placeholder="再次输入新密码" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="saving" @click="handleChangePassword" size="large">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="margin-right:4px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                确认修改
              </el-button>
              <el-button @click="resetPwdForm" size="large">重置</el-button>
            </el-form-item>
          </el-form>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.layout { display: flex; min-height: 100vh; }
.main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.header { height: 60px; background: #fff; padding: 0 20px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #eee; }
.content { padding: 24px; flex: 1; overflow-y: auto; background: #f0f2f5; max-width: 720px; margin: 0 auto; width: 100%; box-sizing: border-box; }

/* ========== 用户信息头部 ========== */
.profile-header {
  background: linear-gradient(135deg, #409eff 0%, #1a6bb5 100%);
  border-radius: 14px; padding: 32px 28px; display: flex; align-items: center; gap: 24px;
  box-shadow: 0 6px 24px rgba(64,158,255,0.25); margin-bottom: 20px; color: #fff;
}
.avatar-ring {
  width: 72px; height: 72px; border-radius: 50%; background: rgba(255,255,255,0.2);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.avatar {
  width: 60px; height: 60px; border-radius: 50%; background: #fff; color: #409eff;
  display: flex; align-items: center; justify-content: center;
  font-size: 26px; font-weight: 700;
}
.profile-name { margin: 0 0 6px; font-size: 22px; font-weight: 700; }
.profile-tags { display: flex; flex-wrap: wrap; gap: 2px; }
.profile-tags :deep(.el-tag) { background: rgba(255,255,255,0.15); border-color: rgba(255,255,255,0.3); color: #fff; }

/* ========== 卡片 ========== */
.section-card {
  background: #fff; border-radius: 12px; padding: 24px; margin-bottom: 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
.section-title {
  display: flex; align-items: center; gap: 8px;
  font-size: 16px; font-weight: 600; color: #333; margin-bottom: 20px; padding-bottom: 14px;
  border-bottom: 1px solid #f0f0f0;
}

/* ========== 基本信息网格 ========== */
.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.info-item { background: #f8fafc; border-radius: 8px; padding: 14px 16px; }
.info-label { display: block; font-size: 12px; color: #999; margin-bottom: 4px; }
.info-value { font-size: 15px; color: #333; font-weight: 500; }

/* ========== 密码表单 ========== */
.pwd-form { max-width: 440px; }
.pwd-form :deep(.el-form-item__label) { font-size: 14px; font-weight: 500; color: #555; padding-bottom: 4px; }
.pwd-form :deep(.el-input__inner) { height: 42px; font-size: 14px; }
</style>
