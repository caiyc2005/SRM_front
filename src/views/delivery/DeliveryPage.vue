<script setup>
import { reactive, ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import AppSidebar from '@/components/AppSidebar.vue'
import AppFilter from '@/components/AppFilter.vue'
import Logout from '@/components/Logout.vue'
import DeliveryTable from './DeliveryTable.vue'
import PrintDialog from './PrintDialog.vue'

import { DEFAULT_SUPPLIERS } from '@/mock'
import { initMockDeliveries } from '@/mock/deliveryData.js'

// ============ 数据状态 ============
const supplierList = ref([...DEFAULT_SUPPLIERS])

const query = reactive({
  deliveryNo: '',
  orderNo: '',
  supplierId: '',
  status: '',
  pageNum: 1,
  pageSize: 10
})

const mockData = ref([])
const tableData = ref([])
const total = ref(0)

// 筛选字段配置
const deliveryStatusOptions = [
  { label: '未收货', value: '0' },
  { label: '已收货', value: '1' }
]
const deliveryFilterFields = [
  { key: 'deliveryNo', label: '送货单号', type: 'input', width: 220 },
  { key: 'orderNo', label: '对应订单号', type: 'input', width: 220 },
  { key: 'supplierId', label: '供应商', type: 'select', width: 220, options: supplierList.value, labelKey: 'name', valueKey: 'id' },
  { key: 'status', label: '收货状态', type: 'select', width: 180, options: deliveryStatusOptions }
]

// 打印相关
const printVisible = ref(false)
const currentDelivery = ref({})

// ============ 计算属性 ============
const filteredData = computed(() => {
  let data = [...mockData.value]
  if (query.deliveryNo) data = data.filter(item => item.deliveryNo.includes(query.deliveryNo))
  if (query.orderNo) data = data.filter(item => item.orderNo.includes(query.orderNo))
  if (query.supplierId) data = data.filter(item => item.supplierId === query.supplierId)
  if (query.status !== '' && query.status != null) data = data.filter(item => item.status === query.status)
  return data
})

// ============ 方法 ============
function loadTable() {
  const data = filteredData.value
  total.value = data.length
  const start = (query.pageNum - 1) * query.pageSize
  tableData.value = data.slice(start, start + query.pageSize)
}

function handleQuery() {
  query.pageNum = 1
  loadTable()
}

function handleReset() {
  query.deliveryNo = ''
  query.orderNo = ''
  query.supplierId = ''
  query.status = ''
  query.pageNum = 1
  loadTable()
}

function handleDelete(row) {
  ElMessageBox.confirm(
    `确认要删除送货单 ${row.deliveryNo} 吗？删除后不可恢复。`,
    '删除确认',
    { type: 'warning' }
  ).then(() => {
    const index = mockData.value.findIndex(item => item.id === row.id)
    if (index > -1) mockData.value.splice(index, 1)
    ElMessage.success('删除成功')
    loadTable()
  }).catch(() => {})
}

function handlePrint(row) {
  currentDelivery.value = row
  printVisible.value = true
}

function confirmPrint() {
  window.print()
}

// ============ 生命周期 ============
onMounted(() => {
  mockData.value = initMockDeliveries()
  loadTable()
})

watch(
  () => [query.pageNum, query.pageSize],
  () => loadTable()
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
      @print="confirmPrint"
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
