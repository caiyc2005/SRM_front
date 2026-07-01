<script setup>
import { useRouter, useRoute } from 'vue-router'
import { ref, computed, watch, onMounted } from 'vue'

const router = useRouter()
const route = useRoute()

/** 当前用户的角色列表 */
const userRoles = ref([])

onMounted(() => {
  const stored = localStorage.getItem('userRoles')
  if (stored) {
    try { userRoles.value = JSON.parse(stored) } catch { userRoles.value = [] }
  }
})

/** 检查当前用户是否有权访问某个路径 */
function hasPathAccess(path) {
  if (!path || userRoles.value.length === 0) return true
  const matched = router.getRoutes().find(r => r.path === path)
  if (!matched || !matched.meta?.roles || matched.meta.roles.length === 0) return true
  return matched.meta.roles.some(role => userRoles.value.includes(role))
}

/** 根据角色过滤后的可见菜单 */
const visibleMenuItems = computed(() => {
  return menuItems
    .map(group => {
      if (!group.children) {
        return hasPathAccess(group.path) ? group : null
      }
      const visibleChildren = group.children.filter(c => hasPathAccess(c.path))
      if (visibleChildren.length === 0) return null
      return { ...group, children: visibleChildren }
    })
    .filter(Boolean)
})

// 待确认订单计数
const pendingCount = ref(0)

/** 当前用户是否有权查看"确认采购单"（只有该菜单显示待确认角标） */
const canViewPendingOrder = computed(() => hasPathAccess('/order/pending'))

async function fetchPendingCount() {
  const token = localStorage.getItem('token')
  if (!token || !canViewPendingOrder.value) return
  try {
    const token = localStorage.getItem('token')
    const res = await fetch('/api/Orders/GetOrdersDetailsByList', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ status: '0', pageIndex: 1, pageSize: 999 })
    })
    const text = await res.text()
    const result = text ? JSON.parse(text) : {}
    if (result.success && result.data) {
      // 前端统计未确认的明细数
      const list = result.data.list || []
      pendingCount.value = list.filter(d => d.isConfirm === 0).length
    }
  } catch { /* 静默失败 */ }
}

// 轮询定时器
let pollTimer = null

function startPolling() {
  if (!canViewPendingOrder.value) return
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
      { key: 'supplier', label: '供应商管理', path: '/supplier' },
      { key: 'supplier-users', label: '供应商子账号', path: '/supplier/users' },
      { key: 'material', label: '物料管理', path: '/basic/material' },
      { key: 'inventory', label: '库存查询', path: '/basic/inventory' },
      { key: 'warehouse', label: '仓库管理', path: '/basic/warehouse' }
    ]
  },
  {
    key: 'order',
    label: '📋 采购订单管理',
    children: [
      { key: 'order-query', label: '订单一览表', path: '/order/query' },
      { key: 'order-create', label: '创建采购单', path: '/order/create' },
      { key: 'order-pending', label: '采购明细确认', path: '/order/pending' },
      
    ]
  },
    {
    key: 'delivery',
    label: '🚚 送货单管理 ',
    children: [
      { key: 'order-pending-delivery', label: '生成送货单', path: '/order/pending-delivery' },
      { key: 'delivery', label: '送货单查询', path: '/delivery' },
      { key: 'delivery-details', label: '送货明细查询', path: '/delivery/details' },
      { key: 'delivery-print', label: '打印送货单', path: '/delivery/printlist' },
    ]
  },
  {
    key: 'cargo',
    label: '🏭 货物管理  ',
    children: [
      { key: 'ship', label: '供应商发货', path: '/ship' },
      { key: 'receive', label: '收料入库', path: '/receive' },
      { key: 'receive-pda', label: 'PDA收料', path: '/receive/pda' }
    ]
  },

  
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
    <template v-for="item in visibleMenuItems" :key="item.key">
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
