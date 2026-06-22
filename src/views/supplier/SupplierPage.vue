<script setup>
/**
 * SupplierPage.vue — 供应商管理
 *
 * 功能：供应商列表查询、添加、编辑、启用/停用、软删除
 * 数据源：DEFAULT_SUPPLIERS（客户端模拟数据）
 */
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import AppSidebar from '@/components/AppSidebar.vue'
import AppFilter from '@/components/AppFilter.vue'
import AppPagination from '@/components/AppPagination.vue'
import Logout from '@/components/Logout.vue'
import { DEFAULT_SUPPLIERS, MOCK_USERS } from '@/mock'

// ==================== 数据状态 ====================
const supplierList = ref([])

const query = reactive({
  supplierCode: '',
  supplierName: '',
  pageNum: 1,
  pageSize: 10
})

// ==================== 筛选字段配置 ====================
const filterFields = [
  { key: 'supplierCode', label: '供应商编码', type: 'input', placeholder: '请输入编码' },
  { key: 'supplierName', label: '供应商名称', type: 'input', placeholder: '请输入名称' }
]

// ==================== 计算属性 ====================
const filteredSuppliers = computed(() => {
  let list = [...supplierList.value]
  const code = query.supplierCode.trim().toLowerCase()
  const name = query.supplierName.trim().toLowerCase()
  if (code) {
    list = list.filter(s => s.supplierCode.toLowerCase().includes(code))
  }
  if (name) {
    list = list.filter(s => s.supplierName.toLowerCase().includes(name))
  }
  return list
})

const tableData = computed(() => {
  const start = (query.pageNum - 1) * query.pageSize
  return filteredSuppliers.value.slice(start, start + query.pageSize)
})

// ==================== 弹窗状态 ====================
const dialogVisible = ref(false)
const dialogTitle = ref('')
const isEdit = ref(false)
const form = reactive({
  supplierID: '',
  supplierCode: '',
  supplierName: '',
  people: '',
  phoneNumber: '',
  address: '',
  memo: ''
})

function resetForm() {
  form.supplierID = ''
  form.supplierCode = ''
  form.supplierName = ''
  form.people = ''
  form.phoneNumber = ''
  form.address = ''
  form.memo = ''
}

// ==================== 搜索 / 筛选 ====================
function handleQuery() {
  query.pageNum = 1
}

function handleReset() {
  query.supplierCode = ''
  query.supplierName = ''
  query.pageNum = 1
}

function handlePageChange() {
  // AppPagination 通过 v-model 自动更新 query.pageNum / pageSize
}

// ==================== CRUD 操作 ====================

/** 打开添加弹窗 */
function openAdd() {
  isEdit.value = false
  dialogTitle.value = '添加供应商'
  resetForm()
  dialogVisible.value = true
}

/** 打开编辑弹窗（预填行数据） */
function openEdit(row) {
  isEdit.value = true
  dialogTitle.value = '编辑供应商'
  form.supplierID = row.supplierID
  form.supplierCode = row.supplierCode
  form.supplierName = row.supplierName
  form.people = row.people
  form.phoneNumber = row.phoneNumber
  form.address = row.address
  form.memo = row.memo || ''
  dialogVisible.value = true
}

/** 提交表单（添加 / 编辑），手动校验 */
function submitForm() {
  if (!form.supplierCode.trim()) {
    ElMessage.warning('供应商编码不能为空')
    return
  }
  if (!form.supplierName.trim()) {
    ElMessage.warning('供应商名称不能为空')
    return
  }
  if (!form.people.trim()) {
    ElMessage.warning('联系人不能为空')
    return
  }
  if (!form.phoneNumber.trim()) {
    ElMessage.warning('联系电话不能为空')
    return
  }
  if (!form.address.trim()) {
    ElMessage.warning('地址不能为空')
    return
  }

  if (isEdit.value) {
    const idx = supplierList.value.findIndex(s => s.supplierID === form.supplierID)
    if (idx !== -1) {
      supplierList.value[idx] = {
        ...supplierList.value[idx],
        supplierCode: form.supplierCode.trim(),
        supplierName: form.supplierName.trim(),
        people: form.people.trim(),
        phoneNumber: form.phoneNumber.trim(),
        address: form.address.trim(),
        memo: form.memo.trim()
      }
      supplierList.value = [...supplierList.value]
    }
    ElMessage.success('供应商信息已更新')
  } else {
    const newId = 'S' + String(supplierList.value.length + 1).padStart(3, '0')
    supplierList.value.unshift({
      supplierID: newId,
      supplierCode: form.supplierCode.trim(),
      supplierName: form.supplierName.trim(),
      people: form.people.trim(),
      phoneNumber: form.phoneNumber.trim(),
      address: form.address.trim(),
      isDel: false,
      memo: form.memo.trim()
    })
    supplierList.value = [...supplierList.value]

    // 自动创建供应商登录账号
    // UserCode=SupplierCode, UserName=SupplierName, Password=123456
    const userId = 'USR' + String(MOCK_USERS.length + 1).padStart(3, '0')
    MOCK_USERS.push({
      id: userId,
      userCode: form.supplierCode.trim(),
      userName: form.supplierName.trim(),
      password: '123456',
      roles: ['供应商']
    })

    ElMessage.success(`供应商添加成功，已自动创建登录账号：${form.supplierCode.trim()}, 初始密码：123456`)
  }

  dialogVisible.value = false
}

/** 启用 / 停用供应商 */
function handleToggleStatus(row) {
  const isCurrentlyDel = row.isDel
  const title = isCurrentlyDel ? '启用供应商' : '停用供应商'
  const message = isCurrentlyDel
    ? `确定要启用供应商「${row.supplierName}」吗？`
    : `确定要停用供应商「${row.supplierName}」吗？停用后该供应商将无法参与采购流程。`
  const btnText = isCurrentlyDel ? '确定启用' : '确定停用'

  ElMessageBox.confirm(message, title, {
    type: 'warning',
    confirmButtonText: btnText
  }).then(() => {
    const target = supplierList.value.find(s => s.supplierID === row.supplierID)
    if (target) {
      target.isDel = !target.isDel
      supplierList.value = [...supplierList.value]
      ElMessage.success(isCurrentlyDel ? '供应商已启用' : '供应商已停用')
    }
  }).catch(() => {})
}

/** 软删除供应商 */
function handleDelete(row) {
  ElMessageBox.confirm(
    `确定要删除供应商「${row.supplierName}」吗？\n删除后该供应商将被标记为已删除状态。`,
    '删除确认',
    { type: 'warning', confirmButtonText: '确定删除' }
  ).then(() => {
    const target = supplierList.value.find(s => s.supplierID === row.supplierID)
    if (target) {
      target.isDel = true
      supplierList.value = [...supplierList.value]
      ElMessage.success(`供应商「${row.supplierName}」已删除`)
    }
  }).catch(() => {})
}

// ==================== 生命周期 ====================
onMounted(() => {
  // 深拷贝避免修改导入的常量
  supplierList.value = DEFAULT_SUPPLIERS.map(s => ({ ...s }))
})

// pageSize 变化时重置页码，避免空页
watch(() => query.pageSize, () => {
  query.pageNum = 1
})
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
        <!-- 搜索筛选 -->
        <AppFilter
          :fields="filterFields"
          :model="query"
          @query="handleQuery"
          @reset="handleReset"
        >
          <template #buttons>
            <el-button type="primary" @click="openAdd">
              <el-icon><Plus /></el-icon>
              添加供应商
            </el-button>
          </template>
        </AppFilter>

        <!-- 供应商列表 -->
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
                <el-tag :type="row.isDel ? 'danger' : 'success'" size="small">
                  {{ row.isDel ? '已停用' : '启用中' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="memo" label="备注" min-width="140" show-overflow-tooltip />
            <el-table-column label="操作" width="220" align="center" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" link size="small" @click="openEdit(row)">
                  编辑
                </el-button>
                <el-button
                  :type="row.isDel ? 'success' : 'warning'"
                  link
                  size="small"
                  @click="handleToggleStatus(row)"
                >
                  {{ row.isDel ? '启用' : '停用' }}
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <AppPagination
            :total="filteredSuppliers.length"
            :query="query"
            @change="handlePageChange"
          />
        </el-card>
      </div>
    </div>

    <!-- 添加 / 编辑弹窗 -->
    <el-dialog
      :model-value="dialogVisible"
      :title="dialogTitle"
      width="520px"
      :close-on-click-modal="false"
      @update:model-value="dialogVisible = $event"
    >
      <el-form :model="form" label-width="90px" label-position="left">
        <el-form-item label="供应商编码" required>
          <el-input v-model="form.supplierCode" placeholder="请输入供应商编码" maxlength="50" />
        </el-form-item>
        <el-form-item label="供应商名称" required>
          <el-input v-model="form.supplierName" placeholder="请输入供应商名称" maxlength="50" />
        </el-form-item>
        <el-form-item label="联系人" required>
          <el-input v-model="form.people" placeholder="请输入联系人姓名" maxlength="50" />
        </el-form-item>
        <el-form-item label="联系电话" required>
          <el-input v-model="form.phoneNumber" placeholder="请输入联系电话" maxlength="50" />
        </el-form-item>
        <el-form-item label="地址" required>
          <el-input v-model="form.address" placeholder="请输入地址" maxlength="50" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="form.memo"
            type="textarea"
            :rows="3"
            placeholder="选填备注信息"
            maxlength="50"
            show-word-limit
          />
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
  background: #f0f2f5;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  font-size: 14px;
}
.table-header span:first-child {
  font-weight: bold;
  color: #333;
}
.table-header span:last-child {
  color: #999;
}
</style>
