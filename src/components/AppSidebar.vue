<script setup>
import { useRouter, useRoute } from 'vue-router'
import { ref, computed, watch, onMounted } from 'vue'

const router = useRouter()
const route = useRoute()

// 待确认订单计数
const pendingCount = ref(0)

async function fetchPendingCount() {
  try {
    const token = localStorage.getItem('token')
    const res = await fetch('/api/Orders/GetOrdersByList?status=0&pageIndex=1&pageSize=1', {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    })
    const text = await res.text()
    const result = text ? JSON.parse(text) : {}
    if (result.success && result.data) {
      pendingCount.value = result.data.total || 0
    }
  } catch { /* 静默失败 */ }
}

// 轮询定时器
let pollTimer = null

function startPolling() {
  stopPolling()
  pollTimer = setInterval(fetchPendingCount, 60000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

onMounted(() => {
  fetchPendingCount()
  startPolling()

  // 页面隐藏时暂停轮询，回到页面时恢复
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopPolling()
    } else {
      fetchPendingCount()   // 切回来时立即刷新一次
      startPolling()
    }
  })
})

const menuItems = [
  {
    key: 'basic',
    label: '📋 基础信息',
    children: [
      { key: 'basic-user', label: '用户管理', path: '/basic/user' },
      { key: 'basic-role', label: '角色管理', path: '/basic/role' },
      { key: 'supplier', label: '供应商管理', path: '/supplier' }
    ]
  },
  {
    key: 'order',
    label: '📋 采购订单管理',
    children: [
      { key: 'order-query', label: '订单一览表', path: '/order/query' },
      { key: 'order-pending', label: '待确认列表', path: '/order/pending' },
      { key: 'order-pending-delivery', label: '生成送货单', path: '/order/pending-delivery' },
    ]
  },
  {
    key: 'warehouse',
    label: '🏭 仓储管理',
    children: [
      { key: 'delivery', label: '送货单查询', path: '/delivery' },
      { key: 'receive', label: '收料入库', path: '/receive' }
    ]
  },
  { key: 'ship', label: '🚚 供应商发货', path: '/ship' }
]

// 当前路由对应的父菜单（只展开当前活跃的菜单组）
const expandedKeys = ref([])

// 当前激活的子菜单项
const activeMenu = computed(() => {
  for (const item of menuItems) {
    if (item.children) {
      for (const child of item.children) {
        if (child.path === route.path) return child.key
      }
    } else if (item.path === route.path) {
      return item.key
    }
  }
  return ''
})

// 切换展开/收起（手风琴：一次只展开一个菜单组）
function toggleExpand(key) {
  const idx = expandedKeys.value.indexOf(key)
  if (idx >= 0) {
    expandedKeys.value.splice(idx, 1) // 已展开则收起
  } else {
    expandedKeys.value = [key] // 展开当前组，收起其他
  }
}

function handleMenuClick(item) {
  if (item.path) router.push(item.path)
}

// 自动展开当前路由对应的父菜单，收起其他所有菜单组
watch(() => route.path, () => {
  expandedKeys.value = []
  for (const item of menuItems) {
    if (item.children) {
      if (item.children.some(c => c.path === route.path)) {
        expandedKeys.value.push(item.key)
        break
      }
    }
  }
}, { immediate: true })
</script>

<template>
  <div class="sidebar">
    <div class="logo">SRM管理系统</div>
    <template v-for="item in menuItems" :key="item.key">
      <!-- 有子菜单的父项 -->
      <template v-if="item.children">
        <div
          class="menu-item menu-parent"
          :class="{ 'has-active': item.children.some(c => c.path === route.path) }"
          @click="toggleExpand(item.key)"
        >
          <span class="arrow">{{ expandedKeys.includes(item.key) ? '▼' : '▶' }}</span>
          {{ item.label }}
        </div>
        <div
          v-for="child in item.children"
          :key="child.key"
          class="menu-item menu-child"
          :class="{ active: activeMenu === child.key }"
          v-show="expandedKeys.includes(item.key)"
          @click="handleMenuClick(child)"
        >
          {{ child.label }}
          <span v-if="child.key === 'order-pending' && pendingCount > 0" class="badge">{{ pendingCount }}</span>
        </div>
      </template>
      <!-- 无子菜单的普通项 -->
      <div
        v-else
        class="menu-item"
        :class="{ active: activeMenu === item.key }"
        @click="handleMenuClick(item)"
      >
        {{ item.label }}
      </div>
    </template>
  </div>
</template>

<style scoped>
.sidebar {
  width: 220px;
  background: #001529;
  color: #fff;
  flex-shrink: 0;
}
.logo {
  height: 60px;
  line-height: 60px;
  text-align: center;
  font-size: 18px;
  background: #002140;
}
.menu-item {
  height: 44px;
  line-height: 44px;
  padding-left: 40px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}
.menu-item:hover {
  background: rgba(24, 144, 255, 0.2);
}
.menu-item.active {
  background: #1890ff;
}
.menu-parent {
  font-weight: bold;
  padding-left: 24px;
}
.menu-parent.has-active {
  background: rgba(24, 144, 255, 0.15);
}
.menu-child {
  padding-left: 50px;
  font-size: 13px;
  height: 38px;
  line-height: 38px;
}
.menu-child.active {
  background: #1890ff;
}
.arrow {
  display: inline-block;
  width: 14px;
  margin-right: 4px;
  font-size: 10px;
  transition: transform 0.2s;
}
.badge {
  display: inline-block;
  min-width: 18px;
  height: 18px;
  line-height: 18px;
  padding: 0 5px;
  margin-left: 6px;
  background: #f56c6c;
  color: #fff;
  font-size: 11px;
  border-radius: 9px;
  text-align: center;
  vertical-align: middle;
}
</style>
