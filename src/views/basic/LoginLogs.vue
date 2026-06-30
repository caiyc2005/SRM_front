<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import AppSidebar from '@/components/AppSidebar.vue'
import Logout from '@/components/Logout.vue'
import AppPagination from '@/components/AppPagination.vue'

const loading = ref(false)
const tableData = ref([])
const total = ref(0)

const query = reactive({
  userCode: '',
  userName: '',
  dateRange: null,
  pageNum: 1,
  pageSize: 20
})

async function loadLogs() {
  loading.value = true
  try {
    const token = localStorage.getItem('token')
    const queryDto = { pageIndex: query.pageNum, pageSize: query.pageSize }
    if (query.userCode) queryDto.userCode = query.userCode
    if (query.userName) queryDto.userName = query.userName
    if (query.dateRange) {
      queryDto.startTime = query.dateRange[0]
      queryDto.endTime = query.dateRange[1]
    }
    const res = await fetch('/api/Login/GetLoginLogs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: JSON.stringify({ queryDto })
    })
    const text = await res.text()
    const result = text ? JSON.parse(text) : {}
    if (result.success && result.data) {
      tableData.value = result.data.list || []
      total.value = result.data.total || 0
    } else {
      tableData.value = []
      total.value = 0
    }
  } catch {
    ElMessage.error('查询失败，后端不可用')
    tableData.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function handleQuery() {
  query.pageNum = 1
  loadLogs()
}

function handleReset() {
  query.userCode = ''
  query.userName = ''
  query.dateRange = null
  query.pageNum = 1
  loadLogs()
}

onMounted(() => {
  loadLogs()
})
</script>

<template>
  <div class="layout">
    <AppSidebar />
    <div class="main">
      <div class="header">
        <h3>登录日志</h3>
        <Logout />
      </div>
      <div class="content">
        <el-card shadow="never">
          <div class="toolbar">
            <el-input v-model="query.userCode" placeholder="账号" clearable style="width:140px" @keyup.enter="handleQuery" />
            <el-input v-model="query.userName" placeholder="姓名" clearable style="width:140px" @keyup.enter="handleQuery" />
            <el-date-picker v-model="query.dateRange" type="datetimerange" range-separator="至" start-placeholder="开始时间" end-placeholder="结束时间" value-format="YYYY-MM-DD HH:mm:ss" style="width:360px" />
            <el-button type="primary" @click="handleQuery">查询</el-button>
            <el-button @click="handleReset">重置</el-button>
          </div>

          <el-table :data="tableData" v-loading="loading" stripe border style="width: 100%">
            <el-table-column type="index" label="序号" width="60" align="center" />
            <el-table-column prop="userCode" label="账号" min-width="120" />
            <el-table-column prop="userName" label="姓名" min-width="120" />
            <el-table-column prop="loginTime" label="登录时间" min-width="170">
              <template #default="{ row }">
                {{ row.loginTime ? row.loginTime.replace('T', ' ') : '' }}
              </template>
            </el-table-column>
            <el-table-column prop="ipAddress" label="IP 地址" min-width="140" />
          </el-table>

          <AppPagination :total="total" :query="query" />
        </el-card>
      </div>
    </div>
  </div>
</template>

<style scoped>
.layout { display: flex; height: 100vh; overflow: hidden; }
.main { flex: 1; display: flex; flex-direction: column; overflow-y: auto; overflow-x: hidden; }
.header { height: 60px; flex-shrink: 0; background: #fff; padding: 0 20px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #eee; }
.content { padding: 20px; flex: 1; background: #f0f2f5; }
.toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
</style>
