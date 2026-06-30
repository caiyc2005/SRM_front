<script setup>
/**
 * Logout.vue — 用户菜单（显示当前用户名 / 角色切换 / 退出登录）
 */
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox, ElMessage } from 'element-plus'

const router = useRouter()
const userName = ref('')
const allRoles = ref([])
const currentRole = ref('')
const roleMemoMap = ref({})
const showSubMenu = ref(false)
const subMenuStyle = ref({})
const subTriggerRef = ref(null)
let subTimer = null

function getRoleDisplay(roleName) {
  return roleMemoMap.value[roleName] || roleName
}

onMounted(async () => {
  try {
    const token = localStorage.getItem('token')
    const res = await fetch('/api/User/GetRoles', {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    })
    const text = await res.text()
    const result = text ? JSON.parse(text) : {}
    if (result.success && result.data?.length) {
      const map = {}
      result.data.forEach(r => { map[r.roleName] = r.memo || r.roleName })
      roleMemoMap.value = map
    }
  } catch { /* 降级 */ }

  const userInfo = localStorage.getItem('userInfo')
  if (userInfo) {
    try {
      const parsed = JSON.parse(userInfo)
      userName.value = parsed.userName || parsed.userCode || '未知用户'
      allRoles.value = Array.isArray(parsed.roles) ? parsed.roles : []
    } catch {
      userName.value = '未知用户'
    }
  } else {
    userName.value = '未登录'
  }

  const stored = localStorage.getItem('userRoles')
  if (stored) {
    try {
      const roles = JSON.parse(stored)
      currentRole.value = Array.isArray(roles) ? roles[0] || '' : ''
    } catch { currentRole.value = '' }
  }
})

const showRoleSwitch = computed(() => allRoles.value.length > 1)

function handleSwitchRole(role) {
  showSubMenu.value = false
  if (role === currentRole.value) return
  ElMessageBox.confirm(
    `确认切换到「${getRoleDisplay(role)}」角色吗？切换后将刷新页面。`,
    '角色切换',
    { type: 'info', confirmButtonText: '确认切换', cancelButtonText: '取消' }
  ).then(() => {
    localStorage.setItem('userRoles', JSON.stringify([role]))
    window.location.reload()
  }).catch(() => {})
}

function openSubMenu(e) {
  if (subTimer) clearTimeout(subTimer)
  const el = e.currentTarget
  if (!el) return
  const rect = el.getBoundingClientRect()
  subMenuStyle.value = {
    left: Math.max(4, rect.left - 150) + 'px',
    top: rect.top + 'px'
  }
  showSubMenu.value = true
}

function closeSubMenu() {
  subTimer = setTimeout(() => {
    showSubMenu.value = false
  }, 200)
}

function onSubEnter() {
  if (subTimer) clearTimeout(subTimer)
  showSubMenu.value = true
}

function onSubLeave() {
  subTimer = setTimeout(() => {
    showSubMenu.value = false
  }, 200)
}

onBeforeUnmount(() => {
  if (subTimer) clearTimeout(subTimer)
})

function handleProfile() {
  router.push('/profile')
}

function handleLogout() {
  ElMessageBox.confirm('确认要退出登录吗？', '退出登录', {
    type: 'info',
    confirmButtonText: '确认退出',
    cancelButtonText: '取消'
  }).then(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('userInfo')
    localStorage.removeItem('userRoles')
    router.push('/login')
  }).catch(() => {})
}
</script>

<template>
  <div class="user-menu-wrap">
    <el-dropdown trigger="hover" placement="bottom-end">
      <span class="user-trigger">
        <span class="user-info">
          <span class="user-name">{{ userName }}</span>
          <el-tag v-if="currentRole" size="small" effect="plain" class="role-tag">{{ getRoleDisplay(currentRole) }}</el-tag>
        </span>
        <el-icon><ArrowDown /></el-icon>
      </span>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item @click="handleProfile">
            <el-icon><User /></el-icon> 个人中心
          </el-dropdown-item>

          <!-- 切换角色（触发子菜单） -->
          <el-dropdown-item
            v-if="showRoleSwitch"
            ref="subTriggerRef"
            divided
            class="submenu-trigger"
            @mouseenter="openSubMenu"
            @mouseleave="closeSubMenu"
          >
            <span style="display:flex;align-items:center;justify-content:space-between;width:100%;">
              <span style="display:flex;align-items:center;gap:6px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                切换角色
              </span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </span>
          </el-dropdown-item>

          <el-dropdown-item divided @click="handleLogout">
            <el-icon><SwitchButton /></el-icon> 退出登录
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>

    <!-- 子菜单：完全独立在 dropdown 外面 -->
    <div
      v-if="showSubMenu"
      class="submenu-box"
      :style="subMenuStyle"
      @mouseenter="onSubEnter"
      @mouseleave="onSubLeave"
    >
      <div
        v-for="role in allRoles" :key="role"
        class="submenu-item"
        :class="{ 'role-active': role === currentRole }"
        @click="handleSwitchRole(role)"
      >
        <span class="role-indicator">
          <svg v-if="role === currentRole" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#409eff" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#bbb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </span>
        {{ getRoleDisplay(role) }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.user-menu-wrap {
  position: relative;
  display: inline-flex;
}
.user-trigger {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #333;
}
.user-trigger:hover {
  color: #409eff;
}
.user-info {
  display: flex;
  align-items: center;
  gap: 6px;
}
.user-name {
  font-weight: 500;
}
.role-tag {
  font-size: 11px !important;
  transform: scale(0.92);
}
.role-indicator {
  display: inline-flex;
  align-items: center;
  width: 18px;
  margin-right: 4px;
}

/* 子菜单独立渲染 */
.submenu-box {
  position: fixed;
  min-width: 140px;
  background: #fff;
  border-radius: 6px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  border: 1px solid #e4e7ed;
  padding: 5px 0;
  z-index: 99999;
}
.submenu-item {
  display: flex;
  align-items: center;
  padding: 8px 16px 8px 20px;
  font-size: 13px;
  color: #333;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
}
.submenu-item:hover {
  background: #ecf5ff;
  color: #409eff;
}
.submenu-item.role-active {
  background: #ecf5ff;
  color: #409eff;
  font-weight: 600;
}
.submenu-trigger {
  display: flex !important;
  align-items: center;
}
</style>
