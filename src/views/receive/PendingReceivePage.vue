<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import ExcelJS from 'exceljs'
import AppSidebar from '@/components/AppSidebar.vue'
import Logout from '@/components/Logout.vue'
import AppPagination from '@/components/AppPagination.vue'

const API_DELIVERY = '/api/Delivery'

const loading = ref(false)
const allOrders = ref([])

const query = reactive({ keyword: '', pageNum: 1, pageSize: 10 })

async function loadData() {
  loading.value = true
  try {
    const token = localStorage.getItem('token')
    const res = await fetch(`${API_DELIVERY}/GetDeliveryNoteNotIn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: JSON.stringify({ page: 1, pageSize: 999, isReceived: false })
    })
    const text = await res.text()
    const result = text ? JSON.parse(text) : {}
    if (result.code === 200 && result.data?.items?.length) {
      allOrders.value = result.data.items.map(item => ({
        orderID: item.noteID, noteCode: item.noteCode || '',
        orderCode: item.details?.[0]?.orderCode || '',
        supplierName: item.supplierName || '', status: String(item.status ?? 0),
        materialCount: item.details?.length || 0,
        totalAmount: (item.details || []).reduce((s, dd) => s + (dd.amount || 0), 0).toFixed(2),
        createTime: item.createdTime ? item.createdTime.replace('T', ' ').slice(0, 16) : '',
        materials: (item.details || []).map((dd, i) => ({
          index: i + 1, orderCode: dd.orderCode || '',
          materialCode: dd.materialCode || '', materialName: dd.materialName || '',
          spec: dd.spec || '', unit: dd.unit || '', qty: dd.quantity || 0,
          unitPrice: dd.unitPrice || 0, amount: dd.amount || 0
        }))
      }))
    } else { allOrders.value = [] }
  } catch { allOrders.value = [] }
  loading.value = false
}

const pendingOrders = computed(() => allOrders.value.filter(o => o.status !== '2'))

const filtered = computed(() => {
  let list = pendingOrders.value; const kw = query.keyword.trim().toLowerCase()
  if (kw) list = list.filter(o => (o.orderCode && o.orderCode.toLowerCase().includes(kw)) || (o.noteCode && o.noteCode.toLowerCase().includes(kw)))
  return list
})
const tableData = computed(() => { const st = (query.pageNum - 1) * query.pageSize; return filtered.value.slice(st, st + query.pageSize) })
const totalFiltered = computed(() => filtered.value.length)

function getStatusText(s) { return s === '2' ? '已收货' : s === '1' ? '已发货' : '未发货' }
function getStatusTag(s) { return s === '2' ? 'success' : s === '1' ? 'primary' : 'warning' }

function handleQuery() { query.pageNum = 1; loadData() }
function handleReset() { query.keyword = ''; query.pageNum = 1; loadData() }

async function handleExport() {
  const data = filtered.value
  if (!data.length) { ElMessage.warning('暂无数据'); return }
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('待收料列表')
  ws.columns = [
    { header: '送货单号', key: 'noteCode', width: 22 }, { header: '订单编号', key: 'orderCode', width: 22 },
    { header: '供应商', key: 'supplierName', width: 20 }, { header: '物料种数', key: 'materialCount', width: 10 },
    { header: '总金额(元)', key: 'totalAmount', width: 14 }, { header: '创建时间', key: 'createTime', width: 20 }
  ]
  data.forEach(r => ws.addRow(r))
  const buf = await wb.xlsx.writeBuffer(); const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `待收料列表_${new Date().toISOString().slice(0, 10)}.xlsx`
  a.click(); URL.revokeObjectURL(blob); ElMessage.success('导出成功')
}

onMounted(() => loadData())
</script>

<template>
  <div class="layout">
    <AppSidebar />
    <div class="main">
      <div class="header"><h3>待收料</h3><Logout /></div>
      <div class="content">
        <el-card shadow="never">
          <div class="toolbar">
            <el-input v-model="query.keyword" placeholder="订单号 / 送货单号" clearable style="width:260px" @keyup.enter="handleQuery" />
            <el-button type="primary" @click="handleQuery">查询</el-button>
            <el-button @click="handleReset">重置</el-button>
            <el-button type="success" @click="handleExport"><el-icon><Download /></el-icon> 导出Excel</el-button>
          </div>
          <el-table :data="tableData" v-loading="loading" stripe border style="width:100%" row-key="orderID">
            <el-table-column type="expand">
              <template #default="{ row }">
                <div class="detail-content">
                  <div class="detail-info">
                    <div><span>供应商：</span><b>{{ row.supplierName }}</b></div>
                    <div><span>订单状态：</span><b>{{ getStatusText(row.status) }}</b></div>
                    <div><span>总金额：</span><b>¥{{ row.totalAmount }}</b></div>
                    <div><span>送货单号：</span><b style="color:#1890ff">{{ row.noteCode || '—' }}</b></div>
                    <div><span>创建时间：</span><b>{{ row.createTime }}</b></div>
                  </div>
                  <el-table :data="row.materials" size="small" border style="width:100%">
                    <el-table-column prop="orderCode" label="订单编号" min-width="150" align="center" />
                    <el-table-column prop="index" label="序号" width="60" align="center" />
                    <el-table-column prop="materialCode" label="物料编码" width="120" align="center" />
                    <el-table-column prop="materialName" label="物料名称" min-width="150" />
                    <el-table-column prop="spec" label="规格" width="120" align="center" />
                    <el-table-column prop="qty" label="采购数量" width="90" align="center" />
                    <el-table-column prop="unit" label="单位" width="70" align="center" />
                    <el-table-column prop="unitPrice" label="单价" align="center" />
                    <el-table-column prop="amount" label="金额" align="center" />
                  </el-table>
                </div>
              </template>
            </el-table-column>
            <el-table-column type="index" label="序号" width="60" align="center" />
            <el-table-column prop="noteCode" label="送货单号" min-width="160" align="center">
              <template #default="{ row }"><span v-if="row.noteCode" style="color:#1890ff">{{ row.noteCode }}</span><span v-else style="color:#999">—</span></template>
            </el-table-column>
            <el-table-column prop="supplierName" label="供应商" min-width="150" />
            <el-table-column prop="materialCount" label="物料种数" align="center" />
            <el-table-column label="订单状态" width="100" align="center">
              <template #default="{ row }"><el-tag :type="getStatusTag(row.status)" size="small">{{ getStatusText(row.status) }}</el-tag></template>
            </el-table-column>
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
.toolbar{display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap}
.detail-content{padding:10px 20px;background:#fafafa}
.detail-info{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px;font-size:13px;color:#555}
.detail-info span{color:#909399}
</style>
