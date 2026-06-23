<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import AppSidebar from '@/components/AppSidebar.vue'
import Logout from '@/components/Logout.vue'

// ==================== API ====================
const API_BASE = '/api/Warehouse'

// ==================== 通用 API 调用 ====================
async function request(method, action, body) {
  const token = localStorage.getItem('token')
  const opts = {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
  }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(`${API_BASE}/${action}`, opts)
  const text = await res.text()
  if (!text) return { success: false, message: '响应内容为空' }
  try { return JSON.parse(text) }
  catch { return { success: false, message: '响应格式错误' } }
}
async function apiGet(action) { return request('GET', action) }
async function apiPost(action, body) { return request('POST', action, body) }

// ==================== 数据 ====================
const list = ref([])
const loading = ref(false)
const keyword = ref('')

// ==================== 加载仓库列表 ====================
async function loadData() {
  loading.value = true
  try {
    const res = await apiGet('GetAllWarehouse')
    if (res.success && res.data?.length) {
      list.value = res.data
    } else {
      list.value = []
    }
  } catch {
    ElMessage.error('加载仓库数据失败，后端不可用')
    list.value = []
  }
  loading.value = false
}

// ==================== 搜索 ====================
const filteredList = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return list.value
  return list.value.filter(item =>
    item.wareCode.toLowerCase().includes(kw) ||
    item.name.toLowerCase().includes(kw) ||
    (item.address && item.address.toLowerCase().includes(kw))
  )
})

// ==================== 表单弹窗 ====================
const dialogVisible = ref(false)
const dialogTitle = ref('')
const isEdit = ref(false)
const form = reactive({
  wareID: '',
  wareCode: '',
  name: '',
  address: '',
  memo: ''
})

function openAdd() {
  isEdit.value = false
  dialogTitle.value = '新增仓库'
  form.wareID = ''
  form.wareCode = ''
  form.name = ''
  form.address = ''
  form.memo = ''
  dialogVisible.value = true
}

function openEdit(row) {
  isEdit.value = true
  dialogTitle.value = '编辑仓库'
  form.wareID = row.wareID
  form.wareCode = row.wareCode
  form.name = row.name
  form.address = row.address
  form.memo = row.memo || ''
  dialogVisible.value = true
}

async function submitForm() {
  if (!form.wareCode) { ElMessage.warning('仓库编码不能为空'); return }
  if (!form.name) { ElMessage.warning('仓库名称不能为空'); return }
  if (!form.address) { ElMessage.warning('仓库地址不能为空'); return }

  if (isEdit.value) {
    try {
      const res = await apiPost('UpdateWarehouse', {
        wareID: form.wareID,
        wareCode: form.wareCode,
        name: form.name,
        address: form.address,
        memo: form.memo || ''
      })
      if (res.success) {
        ElMessage.success('仓库修改成功')
        dialogVisible.value = false
        await loadData()
        return
      }
      ElMessage.error(res.message || '修改失败')
    } catch {
      ElMessage.error('修改失败，后端不可用')
    }
    return
  }

  // ========== 新增 ==========
  try {
    const res = await apiPost('CreateWarehouse', {
      wareCode: form.wareCode,
      name: form.name,
      address: form.address,
      memo: form.memo || ''
    })
    if (res.success) {
      ElMessage.success('仓库新增成功')
      dialogVisible.value = false
      await loadData()
      return
    }
    ElMessage.error(res.message || '新增失败')
  } catch {
    ElMessage.error('新增失败，后端不可用')
  }
}

// ==================== 停用/启用 ====================
function handleToggleStatus(row) {
  const isCurrentlyDel = row.isDel ?? row.IsDel ?? false
  ElMessageBox.confirm(
    isCurrentlyDel ? `确定要启用仓库「${row.name}」吗？` : `确定要停用仓库「${row.name}」吗？停用后该仓库将无法使用。`,
    isCurrentlyDel ? '启用仓库' : '停用仓库',
    { type: 'warning', confirmButtonText: isCurrentlyDel ? '确定启用' : '确定停用' }
  ).then(async () => {
    try {
      // 停用/启用调用 SetWarehouseStatus
      const res = await apiPost('SetWarehouseStatus', { wareID: row.wareID, isEnable: isCurrentlyDel })
      if (res.success) {
        ElMessage.success(isCurrentlyDel ? '仓库已启用' : '仓库已停用')
        await loadData()
        return
      }
      ElMessage.error(res.message || '操作失败')
    } catch {
      ElMessage.error('操作失败，后端不可用')
    }
  }).catch(() => {})
}

// ==================== 生命周期 ====================
onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="layout">
    <AppSidebar />

    <div class="main">
      <div class="header">
        <h3>仓库管理</h3>
        <Logout />
      </div>

      <div class="content">
        <el-card shadow="never">
          <!-- 工具栏 -->
          <div class="toolbar">
            <el-input
              v-model="keyword"
              placeholder="搜索仓库编码 / 名称 / 地址"
              clearable
              style="width: 320px"
            />
            <el-button type="primary" @click="openAdd">新增仓库</el-button>
          </div>

          <!-- 表格 -->
          <el-table
            :data="filteredList"
            v-loading="loading"
            stripe
            border
            style="width: 100%"
          >
            <el-table-column prop="wareCode" label="仓库编码" width="130" align="center" />
            <el-table-column prop="name" label="仓库名称" min-width="160" />
            <el-table-column prop="address" label="地址" min-width="220" />
            <el-table-column prop="memo" label="备注" min-width="150" />
            <el-table-column prop="createTime" label="创建时间" width="170" align="center">
              <template #default="{ row }">
                {{ row.createTime ? row.createTime.replace('T', ' ').slice(0, 16) : '' }}
              </template>
            </el-table-column>
            <el-table-column label="状态" width="80" align="center">
              <template #default="{ row }">
                <el-tag :type="(row.isDel ?? row.IsDel) ? 'danger' : 'success'" size="small">
                  {{ (row.isDel ?? row.IsDel) ? '已停用' : '启用中' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="160" align="center">
              <template #default="{ row }">
                <el-button type="primary" link size="small" @click="openEdit(row)">编辑</el-button>
                <el-button :type="(row.isDel ?? row.IsDel) ? 'success' : 'warning'" link size="small" @click="handleToggleStatus(row)">
                  {{ (row.isDel ?? row.IsDel) ? '启用' : '停用' }}
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <!-- 空状态 -->
          <el-empty v-if="!loading && filteredList.length === 0" description="暂无仓库数据" />
        </el-card>
      </div>
    </div>

    <!-- 新增/编辑弹窗 -->
    <el-dialog
      :model-value="dialogVisible"
      :title="dialogTitle"
      width="520px"
      :close-on-click-modal="false"
      @update:model-value="val => dialogVisible = val"
    >
      <el-form :model="form" label-width="100px">
        <el-form-item label="仓库编码" required>
          <el-input v-model="form.wareCode" placeholder="请输入仓库编码" />
        </el-form-item>
        <el-form-item label="仓库名称" required>
          <el-input v-model="form.name" placeholder="请输入仓库名称" />
        </el-form-item>
        <el-form-item label="地址" required>
          <el-input v-model="form.address" placeholder="请输入仓库地址" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.memo" type="textarea" rows="2" placeholder="选填" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.layout { display: flex; min-height: 100vh; }
.main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.header { height: 60px; background: #fff; padding: 0 20px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #eee; }
.content { padding: 20px; flex: 1; overflow-y: auto; background: #f0f2f5; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
</style>
