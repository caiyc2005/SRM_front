<script setup>
import { reactive, ref, computed, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import ExcelJS from 'exceljs'

import AppSidebar from '@/components/AppSidebar.vue'
import AppFilter from '@/components/AppFilter.vue'
import Logout from '@/components/Logout.vue'
import AppPagination from '@/components/AppPagination.vue'

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
  { label: '全部', value: 'all' },
  { label: '未发货', value: '0' },
  { label: '已发货', value: '1' },
  { label: '已收货', value: '2' }
]

const userRoles = JSON.parse(localStorage.getItem('userRoles') || '[]')
const isSupplier = userRoles.some(r => r === 'supplier' || r === '供应商')

const filterFields = computed(() => {
  const fields = [
    { key: 'noteCode', label: '送货单号', type: 'input', width: 220 },
    { key: 'orderCode', label: '采购单号', type: 'input', width: 220 }
  ]
  if (!isSupplier) {
    fields.push({ key: 'supplierId', label: '供应商', type: 'select', width: 220, options: supplierList.value, labelKey: 'supplierName', valueKey: 'supplierID' })
  }
  fields.push({ key: 'status', label: '货物状态', type: 'select', width: 180, options: deliveryStatusOptions })
  return fields
})

// ============ 方法 ============
async function loadDeliveries() {
  try {
    const token = localStorage.getItem('token')
    const res = await fetch(`${API_BASE}/GetDeliveryNote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        noteCode: query.noteCode || undefined,
        orderCode: query.orderCode || undefined,
        supplierId: query.supplierId || undefined,
        status: query.status && query.status !== 'all' ? Number(query.status) : undefined,
        page: query.pageNum,
        pageSize: query.pageSize
      })
    })
    const text = await res.text()
    const result = text ? JSON.parse(text) : {}

    if (result.code === 200 && result.data) {
      const d = result.data
      // 展平明细
      const flatList = []
      let index = 0
      ;(d.items || []).forEach(item => {
        ;(item.details || []).forEach(dd => {
          flatList.push({
            index: ++index,
            noteCode: item.noteCode,
            orderCode: dd.orderCode || '',
            supplierName: item.supplierName || '',
            status: String(item.status ?? 0),
            materialCode: dd.materialCode || '',
            materialName: dd.materialName || '',
            spec: dd.spec || '',
            unit: dd.unit || '',
            quantity: dd.quantity || 0
          })
        })
      })
      tableData.value = flatList
      total.value = flatList.length
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

function getStatusText(status) {
  return status === '2' ? '已收货' : status === '1' ? '已发货' : '未发货'
}

function getStatusTag(status) {
  return status === '2' ? 'success' : status === '1' ? 'primary' : 'warning'
}

/** 列宽自适应 */
function calcColWidths(headers, rows) {
  return headers.map((h, i) => {
    let maxLen = h.length * 2
    for (const row of rows) {
      const val = String(row[i] ?? '')
      const len = [...val].reduce((s, c) => s + (c.charCodeAt(0) > 127 ? 2 : 1), 0)
      if (len > maxLen) maxLen = len
    }
    return { width: Math.min(maxLen + 4, 60) }
  })
}

async function handleExport() {
  const data = tableData.value
  if (!data || data.length === 0) {
    ElMessage.warning('暂无数据可导出')
    return
  }

  const headers = ['序号', '送货单号', '采购单号', '供应商', '物料编码', '物料名称', '规格', '单位', '数量', '收货状态']

  const rows = data.map(item => [
    item.index,
    item.noteCode,
    item.orderCode,
    item.supplierName,
    item.materialCode,
    item.materialName,
    item.spec,
    item.unit,
    item.quantity,
    getStatusText(item.status)
  ])

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'SRM系统'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('送货明细')

  sheet.columns = calcColWidths(headers, rows)

  const headerRow = sheet.addRow(headers)
  headerRow.font = { name: '微软雅黑', bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF409EFF' } }
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
  headerRow.border = {
    top: { style: 'thin' }, bottom: { style: 'thin' },
    left: { style: 'thin' }, right: { style: 'thin' }
  }
  headerRow.height = 28

  rows.forEach((row, idx) => {
    const dataRow = sheet.addRow(row)
    dataRow.font = { name: '微软雅黑', size: 10.5 }
    dataRow.alignment = { vertical: 'middle', horizontal: 'center' }
    dataRow.border = {
      top: { style: 'thin' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' }
    }
    dataRow.height = 24
    if (idx % 2 === 1) {
      dataRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7FA' } }
    }
  })

  let userName = ''
  try { userName = JSON.parse(localStorage.getItem('userInfo') || '{}').userName || '' } catch {}
  const dateStr = `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}`
  const fileName = `送货明细_${userName}_${dateStr}.xlsx`
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('导出成功')
}

// ============ 生命周期 ============
onMounted(() => {
  if (!isSupplier) loadSuppliers()
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
        <h3>送货明细查询</h3>
        <Logout />
      </div>

      <div class="content">
        <AppFilter
          :fields="filterFields"
          :model="query"
          @query="handleQuery"
          @reset="handleReset"
        >
          <template #buttons>
            <el-button type="success" @click="handleExport">
              <el-icon><Download /></el-icon> 导出Excel
            </el-button>
          </template>
        </AppFilter>

        <div class="card">
          <div class="table-header">
            <span>送货明细</span>
            <span>共 {{ total }} 条记录</span>
          </div>

          <el-table :data="tableData" border size="small" style="width: 100%" show-overflow-tooltip>
            <el-table-column prop="index" label="序号" width="60" align="center" />
            <el-table-column prop="noteCode" label="送货单号" min-width="150" align="center" />
            <el-table-column prop="orderCode" label="采购单号" min-width="140" align="center" />
            <el-table-column v-if="!isSupplier" prop="supplierName" label="供应商" min-width="120" align="center" />
            <el-table-column prop="materialCode" label="物料编码" min-width="110" align="center" />
            <el-table-column prop="materialName" label="物料名称" min-width="130" align="center" />
            <el-table-column prop="spec" label="规格" min-width="90" align="center" />
            <el-table-column prop="unit" label="单位" width="60" align="center" />
            <el-table-column prop="quantity" label="数量" width="90" align="center" />
            <el-table-column label="收货状态" width="90" align="center">
              <template #default="scope">
                <el-tag :type="getStatusTag(scope.row.status)" size="small">
                  {{ getStatusText(scope.row.status) }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>

          <AppPagination :total="total" :query="query" @change="loadDeliveries" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.layout { display: flex; min-height: 100vh; }
.main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.header { height: 60px; background: #fff; padding: 0 20px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #eee; }
.content { padding: 20px; flex: 1; overflow-y: auto; }
.card {
  background: #fff;
  border-radius: 4px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
</style>
