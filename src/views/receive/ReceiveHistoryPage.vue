<script setup>
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import ExcelJS from 'exceljs'
import AppSidebar from '@/components/AppSidebar.vue'
import Logout from '@/components/Logout.vue'
import AppPagination from '@/components/AppPagination.vue'

const API_RECEIVE = '/api/Receive'

const records = ref([])
const loading = ref(false)
const keyword = ref('')

const query = reactive({ pageNum: 1, pageSize: 10, dateRange: null })

async function loadData() {
  loading.value = true
  try {
    const token = localStorage.getItem('token')
    const body = { page: query.pageNum, pageSize: query.pageSize }
    if (query.dateRange) { body.startDate = query.dateRange[0]; body.endDate = query.dateRange[1] }
    const res = await fetch(`${API_RECEIVE}/GetReceivesList`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: JSON.stringify(body)
    })
    const text = await res.text()
    const result = text ? JSON.parse(text) : {}
    if (result.code === 200 && result.data) {
      records.value = (result.data.items || []).map(r => {
        const details = (r.details || []).map(d => ({
          materialCode: d.materialCode, materialName: d.materialName || '',
          spec: d.spec || '', unit: d.unit || '',
          planQty: d.planQty, receivedQty: d.receivedQty, diffQty: d.diffQty,
          orderCode: d.orderCode || r.orderCode || ''
        }))
        return {
          recordCode: r.receiveCode || '', noteCode: r.noteCode || '',
          orderCode: r.orderCode || '', supplierName: r.supplierName || '',
          operator: r.receiveUserName || '',
          receiveDate: r.receiveDate ? r.receiveDate.replace('T', ' ').slice(0, 16) : '',
          items: details,
          totalPlanQty: details.reduce((s, d) => s + d.planQty, 0),
          totalReceivedQty: details.reduce((s, d) => s + d.receivedQty, 0)
        }
      })
    } else { records.value = [] }
  } catch { ElMessage.error('加载失败'); records.value = [] }
  loading.value = false
}

const filtered = computed(() => {
  let list = records.value; const kw = keyword.value.trim().toLowerCase()
  if (kw) list = list.filter(r => [r.noteCode, r.recordCode, r.orderCode, r.supplierName].some(f => f.toLowerCase().includes(kw)))
  if (query.dateRange) { const [s, e] = query.dateRange; list = list.filter(r => (r.receiveDate || '').slice(0, 10) >= s && (r.receiveDate || '').slice(0, 10) <= e) }
  return list
})
const tableData = computed(() => { const st = (query.pageNum - 1) * query.pageSize; return filtered.value.slice(st, st + query.pageSize) })
const totalFiltered = computed(() => filtered.value.length)

function handleQuery() { query.pageNum = 1; loadData() }
function handleReset() { keyword.value = ''; query.dateRange = null; query.pageNum = 1; loadData() }

async function handleExport() {
  const data = filtered.value
  if (!data.length) { ElMessage.warning('暂无数据'); return }
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('收料记录')
  ws.columns = [
    { header: '收料单号', key: 'recordCode', width: 22 }, { header: '送货单号', key: 'noteCode', width: 22 },
    { header: '采购单号', key: 'orderCode', width: 22 }, { header: '供应商', key: 'supplierName', width: 20 },
    { header: '计划总数', key: 'totalPlanQty', width: 12 }, { header: '实收总数', key: 'totalReceivedQty', width: 12 },
    { header: '操作员', key: 'operator', width: 16 }, { header: '收料时间', key: 'receiveDate', width: 20 }
  ]
  data.forEach(r => ws.addRow(r))
  const buf = await wb.xlsx.writeBuffer(); const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `收料记录_${new Date().toISOString().slice(0, 10)}.xlsx`
  a.click(); URL.revokeObjectURL(blob); ElMessage.success('导出成功')
}

onMounted(() => loadData())
</script>

<template>
  <div class="layout">
    <AppSidebar />
    <div class="main">
      <div class="header"><h3>收料记录</h3><Logout /></div>
      <div class="content">
        <el-card shadow="never">
          <div class="toolbar">
            <el-input v-model="keyword" placeholder="搜索送货单号 / 收料单号 / 订单号 / 供应商" clearable style="width:360px" @keyup.enter="handleQuery" />
            <el-date-picker v-model="query.dateRange" type="daterange" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" value-format="YYYY-MM-DD" style="width:240px" />
            <el-button type="primary" @click="handleQuery">查询</el-button>
            <el-button @click="handleReset">重置</el-button>
            <el-button type="success" @click="handleExport"><el-icon><Download /></el-icon> 导出Excel</el-button>
          </div>
          <el-table :data="tableData" v-loading="loading" stripe border style="width:100%" row-key="recordCode">
            <el-table-column type="expand">
              <template #default="{ row }">
                <div class="detail-content">
                  <div class="detail-info">
                    <div><span>收料单号：</span><b>{{ row.recordCode }}</b></div>
                    <div><span>送货单号：</span><b>{{ row.noteCode }}</b></div>
                    <div><span>采购单号：</span><b>{{ row.orderCode }}</b></div>
                    <div><span>供应商：</span><b>{{ row.supplierName }}</b></div>
                    <div><span>收料人员：</span><b>{{ row.operator }}</b></div>
                    <div><span>收料时间：</span><b>{{ row.receiveDate }}</b></div>
                  </div>
                  <el-table :data="row.items" size="small" border style="width:100%">
                    <el-table-column prop="orderCode" label="订单编号" min-width="150" align="center" />
                    <el-table-column prop="materialCode" label="物料编码" width="120" align="center" />
                    <el-table-column prop="materialName" label="物料名称" min-width="150" />
                    <el-table-column prop="spec" label="规格" width="120" align="center" />
                    <el-table-column prop="planQty" label="计划数量" width="90" align="center" />
                    <el-table-column prop="receivedQty" label="实收数量" width="90" align="center" />
                    <el-table-column prop="unit" label="单位" width="70" align="center" />
                  </el-table>
                </div>
              </template>
            </el-table-column>
            <el-table-column type="index" label="序号" width="60" align="center" />
            <el-table-column prop="recordCode" label="收料单号" min-width="160" align="center" />
            <el-table-column prop="noteCode" label="送货单号" min-width="160" align="center" />
            <el-table-column prop="orderCode" label="采购单号" min-width="160" align="center" />
            <el-table-column prop="supplierName" label="供应商" min-width="150" />
            <el-table-column prop="totalPlanQty" label="计划总数" width="90" align="center" />
            <el-table-column prop="totalReceivedQty" label="实收总数" width="90" align="center" />
            <el-table-column prop="operator" label="操作员" min-width="120" align="center" />
            <el-table-column prop="receiveDate" label="收料时间" min-width="160" align="center" />
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
