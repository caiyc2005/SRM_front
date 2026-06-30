<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import AppSidebar from '@/components/AppSidebar.vue'
import Logout from '@/components/Logout.vue'
import AppPagination from '@/components/AppPagination.vue'
import ExcelJS from 'exceljs'

const loading = ref(false)
const tableData = ref([])
const materialList = ref([])
const supplierList = ref([])

const query = reactive({
  recordCode: '',
  noteCode: '',
  orderCode: '',
  supplierName: '',
  materialName: '',
  pageNum: 1,
  pageSize: 20
})

async function loadMaterials() {
  try {
    const token = localStorage.getItem('token')
    const res = await fetch('/api/Materials/GetAll', {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    })
    const text = await res.text()
    const result = text ? JSON.parse(text) : {}
    if (result.success && result.data) materialList.value = result.data
  } catch { /* 静默 */ }
}

async function loadSuppliers() {
  try {
    const token = localStorage.getItem('token')
    const res = await fetch('/api/Supplier/GetAllSuppliers', {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    })
    const text = await res.text()
    const result = text ? JSON.parse(text) : {}
    if (result.success && result.data) supplierList.value = result.data
  } catch { /* 静默 */ }
}

async function loadData() {
  loading.value = true
  try {
    const token = localStorage.getItem('token')
    const res = await fetch('/api/Receive/GetReceivesList', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: JSON.stringify({ page: 1, pageSize: 999 })
    })
    const text = await res.text()
    const result = text ? JSON.parse(text) : {}
    if ((result.code === 200 || result.success) && result.data) {
      const items = result.data.items || []
      const flat = []
      items.forEach(r => {
        const details = r.details || []
        if (details.length > 0) {
          details.forEach(d => {
            flat.push({
              recordCode: r.receiveCode || '',
              noteCode: r.noteCode || '',
              orderCode: r.orderCode || d.orderCode || '',
              supplierName: r.supplierName || '',
              materialName: d.materialName || '',
              planQty: d.planQty || 0,
              receivedQty: d.receivedQty || 0
            })
          })
        } else {
          flat.push({
            recordCode: r.receiveCode || '',
            noteCode: r.noteCode || '',
            orderCode: r.orderCode || '',
            supplierName: r.supplierName || '',
            materialName: '',
            planQty: 0,
            receivedQty: 0
          })
        }
      })
      tableData.value = flat
    } else { tableData.value = [] }
  } catch {
    ElMessage.error('查询失败，后端不可用')
    tableData.value = []
  } finally { loading.value = false }
}

const filteredData = computed(() => {
  let list = tableData.value
  if (query.recordCode) list = list.filter(item => item.recordCode && item.recordCode.toLowerCase().includes(query.recordCode.toLowerCase()))
  if (query.noteCode) list = list.filter(item => item.noteCode && item.noteCode.toLowerCase().includes(query.noteCode.toLowerCase()))
  if (query.orderCode) list = list.filter(item => item.orderCode && item.orderCode.toLowerCase().includes(query.orderCode.toLowerCase()))
  if (query.supplierName) list = list.filter(item => item.supplierName && item.supplierName === query.supplierName)
  if (query.materialName) list = list.filter(item => item.materialName && item.materialName === query.materialName)
  return list
})

const pagedData = computed(() => {
  const start = (query.pageNum - 1) * query.pageSize
  return filteredData.value.slice(start, start + query.pageSize)
})

const totalFiltered = computed(() => filteredData.value.length)

function handleQuery() { query.pageNum = 1; loadData() }
function handleReset() {
  query.recordCode = ''; query.noteCode = ''; query.orderCode = ''
  query.supplierName = ''; query.materialName = ''; query.pageNum = 1
}

async function handleExport() {
  const data = filteredData.value
  if (!data.length) { ElMessage.warning('暂无数据可导出'); return }
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('收料明细')
  sheet.columns = [
    { header: '收料单号', key: 'recordCode', width: 22 },
    { header: '送货单号', key: 'noteCode', width: 22 },
    { header: '采购单号', key: 'orderCode', width: 22 },
    { header: '供应商', key: 'supplierName', width: 20 },
    { header: '物料名称', key: 'materialName', width: 20 },
    { header: '计划数量', key: 'planQty', width: 12 },
    { header: '实收数量', key: 'receivedQty', width: 12 }
  ]
  data.forEach(row => sheet.addRow(row))
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `收料明细_${new Date().toISOString().slice(0, 10)}.xlsx`
  a.click()
  URL.revokeObjectURL(blob)
  ElMessage.success('导出成功')
}

onMounted(() => { loadSuppliers(); loadMaterials(); loadData() })
</script>

<template>
  <div class="layout">
    <AppSidebar />
    <div class="main">
      <div class="header"><h3>收料明细查询</h3><Logout /></div>
      <div class="content">
        <el-card shadow="never">
          <div class="filter-bar">
            <div class="filter-row">
              <div class="filter-item">
                <span class="filter-label">收料单号</span>
                <el-input v-model="query.recordCode" placeholder="" clearable style="width:150px" @keyup.enter="handleQuery" />
              </div>
              <div class="filter-item">
                <span class="filter-label">送货单号</span>
                <el-input v-model="query.noteCode" placeholder="" clearable style="width:150px" @keyup.enter="handleQuery" />
              </div>
              <div class="filter-item">
                <span class="filter-label">采购单号</span>
                <el-input v-model="query.orderCode" placeholder="" clearable style="width:150px" @keyup.enter="handleQuery" />
              </div>
              <div class="filter-item">
                <span class="filter-label">供应商</span>
                <el-select v-model="query.supplierName" placeholder="全部" clearable filterable style="width:150px" @change="handleQuery">
                  <el-option v-for="s in supplierList" :key="s.supplierID" :label="s.supplierName" :value="s.supplierName" />
                </el-select>
              </div>
              <div class="filter-item">
                <span class="filter-label">物料名称</span>
                <el-select v-model="query.materialName" placeholder="全部" clearable filterable style="width:150px" @change="handleQuery">
                  <el-option v-for="m in materialList" :key="m.materialID || m.materialCode" :label="m.materialName" :value="m.materialName" />
                </el-select>
              </div>
              <div class="filter-actions">
                <el-button type="primary" @click="handleQuery">查询</el-button>
                <el-button @click="handleReset">重置</el-button>
                <el-button type="success" @click="handleExport"><el-icon><Download /></el-icon> 导出</el-button>
              </div>
            </div>
          </div>

          <el-table :data="pagedData" v-loading="loading" stripe border style="width: 100%">
            <el-table-column prop="recordCode" label="收料单号" min-width="160" align="center" />
            <el-table-column prop="noteCode" label="送货单号" min-width="160" align="center" />
            <el-table-column prop="orderCode" label="采购单号" min-width="160" align="center" />
            <el-table-column prop="supplierName" label="供应商" min-width="150" />
            <el-table-column prop="materialName" label="物料名称" min-width="150" />
            <el-table-column prop="planQty" label="计划总数" width="100" align="center" />
            <el-table-column prop="receivedQty" label="实收总数" width="100" align="center" />
          </el-table>

          <AppPagination :total="totalFiltered" :query="query" />
        </el-card>
      </div>
    </div>
  </div>
</template>

<style scoped>
.layout{display:flex;height:100vh;overflow:hidden}
.main{flex:1;display:flex;flex-direction:column;overflow-y:auto;overflow-x:hidden}
.header{height:60px;flex-shrink:0;background:#fff;padding:0 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #eee}
.content{padding:20px;flex:1;background:#f0f2f5}
.filter-bar{margin-bottom:16px}
.filter-row{display:flex;flex-wrap:wrap;align-items:flex-end;gap:10px}
.filter-item{display:flex;flex-direction:column;gap:4px}
.filter-label{font-size:12px;color:#909399;font-weight:500}
.filter-actions{display:flex;gap:8px;padding-bottom:1px}
</style>
