<script setup>
import { useRouter, useRoute } from 'vue-router'
import { ref, computed, watch } from 'vue'

const router = useRouter()
const route = useRoute()

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
      { key: 'order-pending', label: '待确认列表', path: '/order/pending' },
      { key: 'order-query', label: '采购订单查询', path: '/order/query' }
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

// 默认展开采购订单管理
const expandedKeys = ref(['order'])

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

// 切换展开/收起
function toggleExpand(key) {
  const idx = expandedKeys.value.indexOf(key)
  if (idx >= 0) {
    expandedKeys.value.splice(idx, 1)
  } else {
    expandedKeys.value.push(key)
  }
}

function handleMenuClick(item) {
  if (item.path) router.push(item.path)
}

// 自动展开当前路由对应的父菜单
watch(() => route.path, () => {
  for (const item of menuItems) {
    if (item.children) {
      const isActive = item.children.some(c => c.path === route.path)
      if (isActive && !expandedKeys.value.includes(item.key)) {
        expandedKeys.value.push(item.key)
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
</style>
