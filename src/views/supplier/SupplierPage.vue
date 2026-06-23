<script setup>
/**
 * SupplierPage.vue — 供应商管理
 *
 * 功能：供应商列表查询、添加、编辑、启用/停用
 * 数据源：优先调用后端 API，不可用时降级到 DEFAULT_SUPPLIERS
 */
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import AppSidebar from '@/components/AppSidebar.vue'
import AppFilter from '@/components/AppFilter.vue'
import AppPagination from '@/components/AppPagination.vue'
import Logout from '@/components/Logout.vue'
import { DEFAULT_SUPPLIERS } from '@/mock'
import { regionData } from 'element-china-area-data'

// ==================== API ====================
const API_BASE = '/api/Supplier'
async function request(method, action, body) {
  const opts = { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined }
  const res = await fetch(`${API_BASE}/${action}`, opts)
  const text = await res.text()
  if (!text) return { success: false, message: '响应内容为空' }
  try { return JSON.parse(text) } catch { return { success: false, message: '响应格式错误' } }
}
async function apiGet(action) { return request('GET', action) }
async function apiPost(action, body) { return request('POST', action, body) }
async function apiPut(action, body) { return request('PUT', action, body) }

// ==================== 数据状态 ====================
const supplierList = ref([])
const query = reactive({ supplierCode: '', supplierName: '', isDel: '', pageNum: 1, pageSize: 10 })
const filterFields = [
  { key: 'supplierCode', label: '供应商编码', type: 'input', placeholder: '请输入编码' },
  { key: 'supplierName', label: '供应商名称', type: 'input', placeholder: '请输入名称' },
  { key: 'isDel', label: '状态', type: 'select', width: 120, options: [{ label: '全部', value: '' }, { label: '启用中', value: 'false' }, { label: '已停用', value: 'true' }] }
]

const filteredSuppliers = computed(() => {
  let list = [...supplierList.value]
  const code = query.supplierCode.trim().toLowerCase()
  const name = query.supplierName.trim().toLowerCase()
  if (code) list = list.filter(s => s.supplierCode.toLowerCase().includes(code))
  if (name) list = list.filter(s => s.supplierName.toLowerCase().includes(name))
  if (query.isDel !== '' && query.isDel != null) {
    list = list.filter(s => String(s.isDel) === query.isDel)
  }
  return list
})

const tableData = computed(() => {
  const start = (query.pageNum - 1) * query.pageSize
  return filteredSuppliers.value.slice(start, start + query.pageSize)
})

const dialogVisible = ref(false)
const dialogTitle = ref('')
const isEdit = ref(false)
const form = reactive({ supplierID: '', supplierCode: '', supplierName: '', people: '', phoneNumber: '', address: '', memo: '' })
const selectedRegion = ref([])
const detailAddress = ref('')

const cascaderProps = { value: 'label', label: 'label', children: 'children' }

function resetForm() {
  Object.assign(form, { supplierID: '', supplierCode: '', supplierName: '', people: '', phoneNumber: '', address: '', memo: '' })
  selectedRegion.value = []
  detailAddress.value = ''
}

// ==================== 数据加载 ====================
async function loadSuppliers() {
  try {
    const res = await apiPost('GetAllSuppliers')
    if (res.success && res.data?.length) { supplierList.value = res.data; return }
  } catch { /* 降级到模拟数据 */ }
  // API 不可用或返回空时，使用 mock 数据（包含已停用供应商）
  supplierList.value = DEFAULT_SUPPLIERS.map(s => ({ ...s }))
}

function handleQuery() { query.pageNum = 1 }
function handleReset() { query.supplierCode = ''; query.supplierName = ''; query.isDel = ''; query.pageNum = 1 }
function handlePageChange() {}

// ==================== CRUD ====================
function openAdd() { isEdit.value = false; dialogTitle.value = '添加供应商'; resetForm(); dialogVisible.value = true }

function openEdit(row) {
  isEdit.value = true; dialogTitle.value = '编辑供应商'
  Object.assign(form, { supplierID: row.supplierID, supplierCode: row.supplierCode, supplierName: row.supplierName, people: row.people, phoneNumber: row.phoneNumber, address: row.address, memo: row.memo || '' })

  const addr = row.address || ''
  const matched = findRegionPath(addr, regionData)
  if (matched) {
    selectedRegion.value = matched
    let detail = addr
    matched.forEach(p => { detail = detail.replace(p, '') })
    detailAddress.value = detail.trim()
  } else {
    selectedRegion.value = []
    detailAddress.value = addr
  }
  dialogVisible.value = true
}

function findRegionPath(addr, nodes) {
  for (const node of nodes) {
    if (addr.startsWith(node.label)) {
      if (node.children && node.children.length > 0) {
        const childPath = findRegionPath(addr, node.children)
        if (childPath) return [node.label, ...childPath]
      }
      return [node.label]
    }
  }
  return null
}

async function submitForm() {
  if (!form.supplierCode.trim()) { ElMessage.warning('供应商编码不能为空'); return }
  if (!form.supplierName.trim()) { ElMessage.warning('供应商名称不能为空'); return }
  if (!form.people.trim()) { ElMessage.warning('联系人不能为空'); return }
  if (!form.phoneNumber.trim()) { ElMessage.warning('联系电话不能为空'); return }
  //地址非必填
// if (selectedRegion.value.length === 0 && !detailAddress.value.trim()) {
//     ElMessage.warning('请选择省市区或填写详细地址')
//     return
//   }
  const fullAddress = (selectedRegion.value.length ? selectedRegion.value.join('') : '') + (detailAddress.value.trim() ? ' ' + detailAddress.value.trim() : '')

  const data = {
    supplierCode: form.supplierCode.trim(),
    supplierName: form.supplierName.trim(),
    people: form.people.trim(),
    phoneNumber: form.phoneNumber.trim(),
    address: fullAddress,
    memo: form.memo.trim()
  }

  if (isEdit.value) {
    try {
      const res = await apiPost('UpdateSupplier', { supplierID: form.supplierID, ...data })
      if (res.success) { ElMessage.success('供应商信息已更新'); dialogVisible.value = false; await loadSuppliers(); return }
      ElMessage.error(res.message || '更新失败')
    } catch {
      const idx = supplierList.value.findIndex(s => s.supplierID === form.supplierID)
      if (idx >= 0) { supplierList.value[idx] = { ...supplierList.value[idx], ...data }; supplierList.value = [...supplierList.value] }
      ElMessage.success('供应商信息已更新（本地）'); dialogVisible.value = false
    }
  } else {
    try {
      const res = await apiPost('AddSupplier', data)
      if (res.success) { ElMessage.success('供应商添加成功'); dialogVisible.value = false; await loadSuppliers(); return }
      ElMessage.error(res.message || '添加失败')
    } catch {
      const newId = 'S' + String(supplierList.value.length + 1).padStart(3, '0')
      supplierList.value.unshift({ supplierID: newId, ...data, isDel: false })
      supplierList.value = [...supplierList.value]
      ElMessage.success('供应商添加成功（本地）'); dialogVisible.value = false
    }
  }
}

function handleToggleStatus(row) {
  const isCurrentlyDel = row.isDel
  ElMessageBox.confirm(
    isCurrentlyDel ? `确定要启用供应商「${row.supplierName}」吗？` : `确定要停用供应商「${row.supplierName}」吗？停用后该供应商将无法参与采购流程。`,
    isCurrentlyDel ? '启用供应商' : '停用供应商',
    { type: 'warning', confirmButtonText: isCurrentlyDel ? '确定启用' : '确定停用' }
  ).then(async () => {
    try {
      const res = await apiPost('UpdateSupplierStatus', { supplierID: row.supplierID, isDel: !isCurrentlyDel })
      if (res.success) { ElMessage.success(isCurrentlyDel ? '供应商已启用' : '供应商已停用'); await loadSuppliers(); return }
      ElMessage.error(res.message || '操作失败')
    } catch {
      row.isDel = !row.isDel; supplierList.value = [...supplierList.value]
      ElMessage.success(isCurrentlyDel ? '供应商已启用（本地）' : '供应商已停用（本地）')
    }
  }).catch(() => {})
}

// ==================== 生命周期 ====================
onMounted(() => { loadSuppliers() })
watch(() => query.pageSize, () => { query.pageNum = 1 })
</script>

<template>
  <div class="layout">
    <AppSidebar />

    <div class="main">
      <div class="header">
        <h3>供应商管理</h3>
        <Logout />
      </div>

      <div class="content">
        <AppFilter :fields="filterFields" :model="query" @query="handleQuery" @reset="handleReset">
          <template #buttons>
            <el-button type="primary" @click="openAdd"><el-icon><Plus /></el-icon> 添加供应商</el-button>
          </template>
        </AppFilter>

        <el-card shadow="never">
          <div class="table-header">
            <span>供应商列表</span>
            <span>共 {{ filteredSuppliers.length }} 条</span>
          </div>

          <el-table :data="tableData" stripe border style="width: 100%">
            <el-table-column type="index" label="序号" width="60" align="center" />
            <el-table-column prop="supplierCode" label="供应商编码" width="140" align="center" />
            <el-table-column prop="supplierName" label="供应商名称" min-width="180" show-overflow-tooltip />
            <el-table-column prop="people" label="联系人" width="100" align="center" />
            <el-table-column prop="phoneNumber" label="联系电话" width="140" align="center" />
            <el-table-column prop="address" label="地址" min-width="200" show-overflow-tooltip />
            <el-table-column label="状态" width="80" align="center">
              <template #default="{ row }">
                <el-tag :type="row.isDel ? 'danger' : 'success'" size="small">{{ row.isDel ? '已停用' : '启用中' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="memo" label="备注" min-width="140" show-overflow-tooltip />
            <el-table-column label="操作" width="150" align="center" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" link size="small" @click="openEdit(row)">编辑</el-button>
                <el-button :type="row.isDel ? 'success' : 'warning'" link size="small" @click="handleToggleStatus(row)">{{ row.isDel ? '启用' : '停用' }}</el-button>
              </template>
            </el-table-column>
          </el-table>

          <AppPagination :total="filteredSuppliers.length" :query="query" @change="handlePageChange" />
        </el-card>
      </div>
    </div>

    <el-dialog :model-value="dialogVisible" :title="dialogTitle" width="600px" :close-on-click-modal="false" @update:model-value="dialogVisible = $event">
      <el-form :model="form" label-width="90px" label-position="left">
        <el-form-item label="供应商编码" required>
          <el-input v-model="form.supplierCode" placeholder="请输入供应商编码" maxlength="50" :disabled="isEdit" />
        </el-form-item>
        <el-form-item label="供应商名称" required><el-input v-model="form.supplierName" placeholder="请输入供应商名称" maxlength="50" /></el-form-item>
        <el-form-item label="联系人" required><el-input v-model="form.people" placeholder="请输入联系人姓名" maxlength="50" /></el-form-item>
        <el-form-item label="联系电话" required><el-input v-model="form.phoneNumber" placeholder="请输入联系电话" maxlength="50" /></el-form-item>
        <el-form-item label="所在地区">
          <el-cascader
            v-model="selectedRegion"
            :options="regionData"
            :props="cascaderProps"
            placeholder="请选择省市区"
            style="width: 100%"
            clearable
          />
        </el-form-item>
        <el-form-item label="详细地址">
          <el-input v-model="detailAddress" placeholder="街道、门牌号、楼层等详细地址" maxlength="100" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.memo" type="textarea" :rows="3" placeholder="选填备注信息" maxlength="50" show-word-limit />
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
.table-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; font-size: 14px; }
.table-header span:first-child { font-weight: bold; color: #333; }
.table-header span:last-child { color: #999; }
</style>
