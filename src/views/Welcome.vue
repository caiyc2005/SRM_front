<script setup>
/**
 * Welcome.vue — 欢迎首页
 */
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AppSidebar from '@/components/AppSidebar.vue'
import Logout from '@/components/Logout.vue'

const router = useRouter()
const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}')
const userName = userInfo.userName || '用户'
const currentTime = ref('')
const weekDays = ['日', '一', '二', '三', '四', '五', '六']

// 获取当前角色（一个用户可能有多个角色，取当前活跃的）
const currentRole = (() => {
  const stored = localStorage.getItem('userRoles')
  if (stored) {
    try { return JSON.parse(stored)[0] || '' } catch {}
  }
  return ''
})()

/** 根据路由 meta.roles 判断当前角色是否有权限访问 */
function hasAccess(path) {
  const route = router.getRoutes().find(r => r.path === path)
  if (!route || !route.meta?.roles || route.meta.roles.length === 0) return true
  return route.meta.roles.includes(currentRole)
}

function updateTime() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const w = weekDays[now.getDay()]
  const h = String(now.getHours()).padStart(2, '0')
  const mi = String(now.getMinutes()).padStart(2, '0')
  const s = String(now.getSeconds()).padStart(2, '0')
  currentTime.value = `${y}年${m}月${d}日 星期${w} ${h}:${mi}:${s}`
}

onMounted(() => {
  updateTime()
  setInterval(updateTime, 1000)
})
</script>

<template>
  <div class="layout">
    <AppSidebar />

    <div class="main">
      <div class="header">
        <h3>首页</h3>
        <Logout />
      </div>

      <div class="content">
        <div class="welcome-card">
          <div class="welcome-banner">
            <div class="welcome-icon">
              <svg viewBox="0 0 80 80" width="80" height="80" fill="none">
                <rect x="8" y="20" width="64" height="48" rx="6" stroke="#409eff" stroke-width="3.5" fill="#ecf5ff"/>
                <path d="M28 38 L36 46 L52 30" stroke="#409eff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="40" cy="12" r="6" fill="#409eff" opacity="0.3"/>
                <path d="M16 20 L40 8 L64 20" stroke="#409eff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.5"/>
              </svg>
            </div>
            <h1 class="welcome-title">欢迎使用 SRM 供应商管理系统</h1>
            <p class="welcome-subtitle">高效的供应链管理平台，帮助您轻松管理采购、送货与收料全流程</p>
            <div class="welcome-time">{{ currentTime }}</div>
            <div class="welcome-user">您好，{{ userName }}</div>
          </div>

          <div class="feature-grid">
            <div class="feature-card" v-if="hasAccess('/order/query')" @click="router.push('/order/query')">
              <div class="feature-icon" style="background:#ecf5ff;">
                <svg viewBox="0 0 28 28" width="28" height="28" fill="none" stroke="#409eff" stroke-width="2" stroke-linecap="round">
                  <path d="M4 8h20M4 14h20M4 20h20"/>
                  <rect x="3" y="4" width="22" height="20" rx="2"/>
                </svg>
              </div>
              <div class="feature-name">订单一览表</div>
              <div class="feature-desc">查看所有采购订单及状态</div>
            </div>

            <div class="feature-card" v-if="hasAccess('/order/create')" @click="router.push('/order/create')">
              <div class="feature-icon" style="background:#f0f9eb;">
                <svg viewBox="0 0 28 28" width="28" height="28" fill="none" stroke="#67c23a" stroke-width="2" stroke-linecap="round">
                  <line x1="14" y1="6" x2="14" y2="22"/>
                  <line x1="6" y1="14" x2="22" y2="14"/>
                  <circle cx="14" cy="14" r="11"/>
                </svg>
              </div>
              <div class="feature-name">创建采购单</div>
              <div class="feature-desc">新增采购订单</div>
            </div>

            <div class="feature-card" v-if="hasAccess('/delivery')" @click="router.push('/delivery')">
              <div class="feature-icon" style="background:#fef0f0;">
                <svg viewBox="0 0 28 28" width="28" height="28" fill="none" stroke="#f56c6c" stroke-width="2" stroke-linecap="round">
                  <rect x="4" y="10" width="16" height="12" rx="2"/>
                  <path d="M8 22v2h12v-2"/>
                  <circle cx="8" cy="22" r="2" fill="none"/>
                  <circle cx="18" cy="22" r="2" fill="none"/>
                  <path d="M20 14l4-4h-4V6h-6"/>
                </svg>
              </div>
              <div class="feature-name">送货单查询</div>
              <div class="feature-desc">查询送货单及收货状态</div>
            </div>

            <div class="feature-card" v-if="hasAccess('/receive')" @click="router.push('/receive')">
              <div class="feature-icon" style="background:#fdf6ec;">
                <svg viewBox="0 0 28 28" width="28" height="28" fill="none" stroke="#e6a23c" stroke-width="2" stroke-linecap="round">
                  <path d="M6 14l4 4 12-12"/>
                  <circle cx="14" cy="14" r="11"/>
                </svg>
              </div>
              <div class="feature-name">收料入库</div>
              <div class="feature-desc">扫码收料操作</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.layout { display: flex; min-height: 100vh; }
.main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.header { height: 60px; background: #fff; padding: 0 20px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #eee; }
.content { padding: 20px; flex: 1; overflow-y: auto; background: #f0f2f5; }

.welcome-card {
  max-width: 900px; margin: 40px auto;
}
.welcome-banner {
  background: linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%);
  color: #fff; border-radius: 16px; padding: 48px 40px; text-align: center;
  box-shadow: 0 8px 32px rgba(26, 115, 232, 0.25);
  margin-bottom: 32px;
}
.welcome-icon { margin-bottom: 16px; }
.welcome-title { font-size: 28px; font-weight: 700; margin: 0 0 12px; letter-spacing: 2px; }
.welcome-subtitle { font-size: 15px; opacity: 0.85; margin: 0 0 24px; }
.welcome-time { font-size: 16px; opacity: 0.9; margin-bottom: 8px; font-family: monospace; }
.welcome-user { font-size: 18px; font-weight: 600; opacity: 0.95; }

.feature-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px;
}
.feature-card {
  background: #fff; border-radius: 12px; padding: 24px 20px; text-align: center;
  cursor: pointer; transition: all 0.25s; border: 1px solid #eee;
}
.feature-card:hover {
  transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.1); border-color: #409eff;
}
.feature-icon {
  width: 56px; height: 56px; border-radius: 14px; display: flex; align-items: center; justify-content: center;
  margin: 0 auto 14px;
}
.feature-name { font-size: 16px; font-weight: 600; color: #333; margin-bottom: 6px; }
.feature-desc { font-size: 13px; color: #999; }
</style>
