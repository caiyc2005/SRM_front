<script setup>
import { reactive, ref, computed, onMounted, watch } from 'vue'

// 已有 computed 导入
import { ElMessage, ElMessageBox } from 'element-plus'

import AppSidebar from '@/components/AppSidebar.vue'
import AppFilter from '@/components/AppFilter.vue'
import Logout from '@/components/Logout.vue'
import DeliveryTable from './DeliveryTable.vue'
import PrintDialog from './PrintDialog.vue'

// ============ API ============
const API_BASE = '/api/Delivery'
const useApi = ref(false)

// ============ 数据状态 ============
const supplierList = ref([])

async function loadSuppliers() {
  try {
    const token = localStorage.getItem('token')
    const res = await fetch('/api/Supplier/GetAllSuppliers', {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    })
    const text = await res.text()
    const result = text ? JSON.parse(text) : {}
    if (result.success && result.data?.length) {
      supplierList.value = result.data
    }
  } catch { /* 降级 */ }
}

const query = reactive({
  noteCode: '',
  // orderNo: '',
  orderCode: '',
  supplierId: '',
  status: '',
  pageNum: 1,
  pageSize: 10
})

const tableData = ref([])
const total = ref(0)

// 筛选字段配置
const deliveryStatusOptions = [
  { label: '未收货', value: '0' },
  { label: '已收货', value: '1' }
]

// 当前用户角色
const userRoles = JSON.parse(localStorage.getItem('userRoles') || '[]')
const isSupplier = userRoles.some(r => r === 'supplier' || r === '供应商')

// 送货单筛选显示字段
const deliveryFilterFields = computed(() => {
  const fields = [
    { key: 'noteCode', label: '送货单号', type: 'input', width: 220 },
    { key: 'orderCode', label: '对应订单号', type: 'input', width: 220 }
  ]
  // 供应商不显示供应商筛选
  if (!isSupplier) {
    fields.push({ key: 'supplierId', label: '供应商', type: 'select', width: 220, options: supplierList.value, labelKey: 'supplierName', valueKey: 'supplierID' })
  }
  fields.push({ key: 'status', label: '收货状态', type: 'select', width: 180, options: deliveryStatusOptions })
  return fields
})

// 打印相关
const printVisible = ref(false)
const currentDelivery = ref({})

// ============ 方法 ============
async function loadDeliveries() {
  // ========== 优先调后端 API ==========
  try {
    const token = localStorage.getItem('token')
    const res = await fetch(`${API_BASE}/GetDeliveryNote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        noteCode: query.noteCode || undefined,
        orderCode: query.orderCode || undefined,//把orderCode字段传给后端
        supplierId: query.supplierId || undefined,
        status: query.status !== '' && query.status != null ? (query.status === '1') : undefined,
        page: query.pageNum,
        pageSize: query.pageSize
      })
    })
    const text = await res.text()
    const result = text ? JSON.parse(text) : {}

    if (result.code === 200 && result.data) {
      const d = result.data
      total.value = d.total
      tableData.value = (d.items || []).map(item => ({
        id: item.noteID,
        noteCode: item.noteCode,
        orderCode: item.orderCode || '',
        supplierId: item.supplierID || '',
        supplierCode: item.supplierCode || '',
        supplierName: item.supplierName || '',
        status: item.status ? '1' : '0',
        materialCount: item.details?.length || 0,
        expectDate: item.expectedDate ? item.expectedDate.slice(0, 10) : '',
        createTime: item.createdTime ? item.createdTime.replace('T', ' ').slice(0, 16) : '',
        receiveTime: item.deliveryDate ? item.deliveryDate.replace('T', ' ').slice(0, 16) : '',
        operator: item.createByName || '',
        materials: (item.details || []).map((dd, i) => ({
          index: i + 1,
          materialCode: dd.materialCode,
          materialName: dd.materialName || '',
          spec: dd.spec,// || dd.specification || '',
          unit: dd.unit || '',
          quantity: dd.quantity,
          receivedQty: dd.receivedQty || 0,
          remark: ''
        }))
      }))
      useApi.value = true
      return
    }
  } catch { /* 后端不可用 */ }
}

function handleQuery() {
  query.pageNum = 1
  loadDeliveries()
}

function handleReset() {
  query.noteCode = ''
  query.orderCode = ''
  query.supplierId = ''
  query.status = ''
  query.pageNum = 1
  loadDeliveries()
}

async function handleDelete(row) {
  ElMessageBox.confirm(
    `确认要删除送货单 ${row.noteCode} 吗？删除后不可恢复。`,
    '删除确认',
    { type: 'warning' }
  ).then(async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE}/DeleteDeliveryNote/${row.id}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
      const text = await res.text()
      const result = text ? JSON.parse(text) : {}
      if (result.code === 200) {
        ElMessage.success('删除成功')
        await loadDeliveries()
        return
      }
      ElMessage.error(result.message || '删除失败')
    } catch {
      ElMessage.error('后端删除失败')
    }
  }).catch(() => {})
}

function handlePrint(row) {
  currentDelivery.value = row
  printVisible.value = true
}

// ============ 生命周期 ============
onMounted(() => {
  loadSuppliers()
  loadDeliveries()
})

watch(
  () => [query.pageNum, query.pageSize],
  () => loadDeliveries()
)
</script>

<template>
  <div class="layout">
    <AppSidebar />

    <div class="main">
      <div class="header">
        <h3>送货单管理</h3>
        <Logout />
      </div>

      <div class="content">
        <AppFilter
          :fields="deliveryFilterFields"
          :model="query"
          @query="handleQuery"
          @reset="handleReset"
        />

        <DeliveryTable
          :table-data="tableData"
          :total="total"
          :query="query"
          @print="handlePrint"
          @delete="handleDelete"
        />
      </div>
    </div>

    <PrintDialog
      :visible="printVisible"
      :delivery="currentDelivery"
      @update:visible="printVisible = $event"
    />
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  min-height: 100vh;
}
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.header {
  height: 60px;
  background: #fff;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #eee;
}
.content {
  padding: 20px;
  flex: 1;
  overflow-y: auto;
}
</style>
