<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import AppSidebar from '@/components/AppSidebar.vue'
import Logout from '@/components/Logout.vue'

// ==================== API ====================
const API_BASE = '/api/Inventory'

// ==================== 数据 ====================
const list = ref([])
const loading = ref(false)
const keyword = ref('')
const wareFilter = ref('')
const warehouses = ref([])

// ==================== 加载库存 ====================
async function loadData() {
  loading.value = true
  try {
    const token = localStorage.getItem('token')
    const res = await fetch(`${API_BASE}/GetAllFromInventory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
    })
    const text = await res.text()
    const result = text ? JSON.parse(text) : {}
    if (result.success && result.data?.length) {
      list.value = result.data
    } else {
      list.value = []
    }
  } catch {
    ElMessage.error('加载库存数据失败，后端不可用')
    list.value = []
  }
  loading.value = false
}

// ==================== 仓库列表（从仓库API加载） ====================
async function loadWarehouses() {
  try {
    const token = localStorage.getItem('token')
    const res = await fetch('/api/Warehouse/GetAllWarehouse', {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    })
    const text = await res.text()
    const result = text ? JSON.parse(text) : {}
    if (result.success && result.data?.length) {
      warehouses.value = result.data
    }
  } catch { /* 静默失败 */ }
}

// ==================== 筛选 ====================
const filteredList = computed(() => {
  let data = list.value
  const kw = keyword.value.trim().toLowerCase()
  if (kw) {
    data = data.filter(item =>
      item.materialCode.toLowerCase().includes(kw) ||
      item.materialName.toLowerCase().includes(kw) ||
      item.spec.toLowerCase().includes(kw)
    )
  }
  if (wareFilter.value) {
    data = data.filter(item => item.wareID === wareFilter.value)
  }
  return data
})

// ==================== 生命周期 ====================
onMounted(() => {
  loadData()
  loadWarehouses()
})
</script>

<template>
  <div class="layout">
    <AppSidebar />

    <div class="main">
      <div class="header">
        <h3>库存查询</h3>
        <Logout />
      </div>

      <div class="content">
        <el-card shadow="never">
          <!-- 工具栏 -->
          <div class="toolbar">
            <div class="toolbar-left">
              <el-input
                v-model="keyword"
                placeholder="搜索物料编码 / 名称 / 规格"
                clearable
                style="width: 300px"
              />
              <el-select
                v-model="wareFilter"
                placeholder="全部仓库"
                clearable
                style="width: 180px"
              >
                <el-option
                  v-for="w in warehouses"
                  :key="w.wareID"
                  :label="w.name || w.wareName"
                  :value="w.wareID"
                />
              </el-select>
            </div>
            <el-button type="primary" @click="loadData">刷新</el-button>
          </div>

          <!-- 表格 -->
          <el-table
            :data="filteredList"
            v-loading="loading"
            stripe
            border
            style="width: 100%"
          >
            <el-table-column type="index" label="序号" width="60" align="center" />
            <el-table-column prop="materialCode" label="物料编码" width="130" align="center" />
            <el-table-column prop="materialName" label="物料名称" min-width="150" />
            <el-table-column prop="spec" label="规格" min-width="160" />
            <el-table-column prop="unit" label="单位" width="70" align="center" />
            <el-table-column prop="qty" label="库存数量" width="110" align="center">
              <template #default="{ row }">
                <b :style="{ color: row.qty > 0 ? '#409eff' : '#f56c6c' }">{{ row.qty }}</b>
              </template>
            </el-table-column>
            <el-table-column prop="wareCode" label="仓库编码" width="110" align="center" />
            <el-table-column prop="wareName" label="仓库名称" width="130" align="center" />
            <el-table-column prop="lastReceiveTime" label="最后入库时间" width="170" align="center" />
            <el-table-column prop="updateByName" label="更新人" width="100" align="center" />
          </el-table>

          <!-- 合计 -->
          <div class="summary">
            共计 <b>{{ filteredList.length }}</b> 条库存记录
          </div>

          <!-- 空状态 -->
          <el-empty v-if="!loading && filteredList.length === 0" description="暂无库存数据" />
        </el-card>
      </div>
    </div>
  </div>
</template>

<style scoped>
.layout { display: flex; min-height: 100vh; }
.main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.header { height: 60px; background: #fff; padding: 0 20px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #eee; }
.content { padding: 20px; flex: 1; overflow-y: auto; background: #f0f2f5; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.toolbar-left { display: flex; gap: 12px; align-items: center; }
.summary { margin-top: 16px; font-size: 13px; color: #909399; }
</style>
