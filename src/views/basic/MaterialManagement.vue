<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import AppSidebar from '@/components/AppSidebar.vue'
import Logout from '@/components/Logout.vue'

// ==================== API 基础路径 ====================
const API_BASE = '/api/Materials'

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
const materials = ref([])
const loading = ref(false)
const keyword = ref('')

// ==================== 加载物料列表 ====================
async function loadMaterials() {
  loading.value = true
  try {
    const res = await apiGet('GetAll')
    if (res.success && res.data?.length) {
      materials.value = res.data
      loading.value = false
      return
    }
  } catch { /* API 不可用，显示空列表 */ }
  materials.value = []
  loading.value = false
}

// ==================== 搜索 ====================
const filteredMaterials = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return materials.value.filter(m => !m.isDel)
  return materials.value.filter(m =>
    !m.isDel && (
      m.materialCode.toLowerCase().includes(kw) ||
      m.materialName.toLowerCase().includes(kw)
    )
  )
})

// ==================== 表单弹窗 ====================
const dialogVisible = ref(false)
const dialogTitle = ref('')
const isEdit = ref(false)
const form = reactive({
  materialID: '',
  materialCode: '',
  materialName: '',
  spec: '',
  unit: '',
  memo: ''
})

function openAdd() {
  isEdit.value = false
  dialogTitle.value = '新增物料'
  form.materialID = ''
  form.materialCode = ''
  form.materialName = ''
  form.spec = ''
  form.unit = ''
  form.memo = ''
  dialogVisible.value = true
}

function openEdit(row) {
  isEdit.value = true
  dialogTitle.value = '编辑物料'
  form.materialID = row.materialID
  form.materialCode = row.materialCode
  form.materialName = row.materialName
  form.spec = row.spec
  form.unit = row.unit
  form.memo = row.memo || ''
  dialogVisible.value = true
}

async function submitForm() {
  if (!form.materialCode) { ElMessage.warning('物料编码不能为空'); return }
  if (!form.materialName) { ElMessage.warning('物料名称不能为空'); return }
  if (!form.spec) { ElMessage.warning('规格不能为空'); return }
  if (!form.unit) { ElMessage.warning('单位不能为空'); return }

  if (isEdit.value) {
    // ========== 编辑 ==========
    try {
      const res = await apiPost('UpdateMaterial', {
        materialID: form.materialID,
        materialCode: form.materialCode,
        materialName: form.materialName,
        spec: form.spec,
        unit: form.unit,
        memo: form.memo || ''
      })
      if (res.success) {
        ElMessage.success('物料修改成功')
        dialogVisible.value = false
        await loadMaterials()
        return
      }
      ElMessage.error(res.message || '修改失败')
    } catch { /* 降级到本地 */ }

    // ========== 降级：本地 ==========
    const target = materials.value.find(m => m.materialID === form.materialID)
    if (target) {
      target.materialCode = form.materialCode
      target.materialName = form.materialName
      target.spec = form.spec
      target.unit = form.unit
      target.memo = form.memo
    }
    ElMessage.success('物料修改成功（本地）')
    dialogVisible.value = false
    return
  }

  // ========== 新增 ==========
  // 本地唯一性校验
  const exists = materials.value.find(m =>
    m.materialCode.toLowerCase() === form.materialCode.toLowerCase() && !m.isDel
  )
  if (exists) {
    ElMessage.warning('物料编码已存在')
    return
  }

  try {
    const res = await apiPost('CreateMaterial', {
      materialCode: form.materialCode,
      materialName: form.materialName,
      spec: form.spec,
      unit: form.unit,
      memo: form.memo || ''
    })
    if (res.success) {
      ElMessage.success('物料新增成功')
      dialogVisible.value = false
      await loadMaterials()
      return
    }
    ElMessage.error(res.message || '新增失败')
  } catch { /* 降级到本地 */ }

  // ========== 降级：本地 ==========
  const newMaterial = {
    materialID: 'M' + String(Date.now()).slice(-6),
    materialCode: form.materialCode,
    materialName: form.materialName,
    spec: form.spec,
    unit: form.unit,
    memo: form.memo || '',
    isDel: false
  }
  materials.value.unshift(newMaterial)
  ElMessage.success('物料新增成功（本地）')
  dialogVisible.value = false
}

// ==================== 删除 ====================
function handleDelete(row) {
  ElMessageBox.confirm(
    `确定要删除物料「${row.materialName}」吗？`,
    '删除确认',
    { type: 'warning', confirmButtonText: '确定删除' }
  ).then(async () => {
    try {
      const res = await apiPost('DeleteMaterial', { materialID: row.materialID })
      if (res.success) {
        ElMessage.success('物料已删除')
        await loadMaterials()
        return
      }
      ElMessage.error(res.message || '删除失败')
    } catch {
      ElMessage.error('删除失败，后端不可用')
    }
  }).catch(() => {})
}

// ==================== 生命周期 ====================
onMounted(() => {
  loadMaterials()
})
</script>

<template>
  <div class="layout">
    <AppSidebar />

    <div class="main">
      <div class="header">
        <h3>物料管理</h3>
        <Logout />
      </div>

      <div class="content">
        <el-card shadow="never">
          <!-- 工具栏 -->
          <div class="toolbar">
            <el-input
              v-model="keyword"
              placeholder="搜索物料编码 / 物料名称"
              clearable
              style="width: 300px"
              @keyup.enter=""
            />
            <el-button type="primary" @click="openAdd">新增物料</el-button>
          </div>

          <!-- 表格 -->
          <el-table
            :data="filteredMaterials"
            v-loading="loading"
            stripe
            border
            style="width: 100%"
          >
            <el-table-column prop="materialCode" label="物料编码" width="130" align="center" />
            <el-table-column prop="materialName" label="物料名称" min-width="160" />
            <el-table-column prop="spec" label="规格" min-width="180" />
            <el-table-column prop="unit" label="单位" width="80" align="center" />
            <el-table-column prop="memo" label="备注" min-width="140" />
            <el-table-column label="状态" width="80" align="center">
              <template #default="{ row }">
                <el-tag :type="row.isDel ? 'danger' : 'success'" size="small">
                  {{ row.isDel ? '已禁用' : '启用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="160" align="center">
              <template #default="{ row }">
                <el-button type="primary" link size="small" @click="openEdit(row)">编辑</el-button>
                <el-button type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>

          <!-- 空状态 -->
          <el-empty v-if="!loading && filteredMaterials.length === 0" description="暂无物料数据" />
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
        <el-form-item label="物料编码" required>
          <el-input v-model="form.materialCode" placeholder="请输入物料编码" />
        </el-form-item>
        <el-form-item label="物料名称" required>
          <el-input v-model="form.materialName" placeholder="请输入物料名称" />
        </el-form-item>
        <el-form-item label="规格" required>
          <el-input v-model="form.spec" placeholder="请输入规格" />
        </el-form-item>
        <el-form-item label="单位" required>
          <el-input v-model="form.unit" placeholder="请输入单位（如：个、平方米、根）" />
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
