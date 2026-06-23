<script setup>
/**
 * Logout.vue — 用户菜单（显示当前用户名 / 退出登录）
 */
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox, ElMessage } from 'element-plus'

const router = useRouter()
const userName = ref('')

onMounted(() => {
  const userInfo = localStorage.getItem('userInfo')
  if (userInfo) {
    try {
      const parsed = JSON.parse(userInfo)
      userName.value = parsed.userName || parsed.userCode || '未知用户'
    } catch {
      userName.value = '未知用户'
    }
  } else {
    userName.value = '未登录'
  }
})

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

function handleProfile() {
  // 个人中心暂不实现
}
</script>

<template>
  <el-dropdown trigger="hover" placement="bottom-end">
    <span class="user-trigger">
      当前用户：{{ userName }}
      <el-icon><ArrowDown /></el-icon>
    </span>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item :disabled="true" @click="handleProfile">
          <el-icon><User /></el-icon> 个人中心
        </el-dropdown-item>
        <el-dropdown-item divided @click="handleLogout">
          <el-icon><SwitchButton /></el-icon> 退出登录
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<style scoped>
.user-trigger {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  color: #333;
}
.user-trigger:hover {
  color: #409eff;
}
</style>
