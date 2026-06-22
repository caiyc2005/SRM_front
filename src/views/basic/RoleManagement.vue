<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import AppSidebar from '@/components/AppSidebar.vue'
import Logout from '@/components/Logout.vue'
import { MOCK_USERS, MOCK_ROLES, MOCK_USER_ROLES } from '@/mock'

// ==================== API ====================
const API_BASE = '/api/User'
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
async function apiDelete(action, body) { return request('DELETE', action, body) }

// ==================== 角色管理 ====================
const roles = ref([])
const roleLoading = ref(false)
const roleFormVisible = ref(false)
const roleForm = reactive({ id: '', roleName: '', memo: '' })

async function loadRoles() {
  roleLoading.value = true
  try {
    const res = await apiGet('GetRoles')
    if (res.success && res.data?.length) { roles.value = res.data; return }
  } catch { /* 降级 */ }
  if (roles.value.length === 0) roles.value = JSON.parse(JSON.stringify(MOCK_ROLES))
  roleLoading.value = false
}

function openAddRole() {
  Object.assign(roleForm, { id: '', roleName: '', memo: '' })
  roleFormVisible.value = true
}

async function submitRole() {
  if (!roleForm.roleName.trim()) { ElMessage.warning('角色名称不能为空'); return }
  try {
    const res = await apiPost('AddRole', { roleName: roleForm.roleName, memo: roleForm.memo })
    if (res.success) { ElMessage.success('角色添加成功'); roleFormVisible.value = false; await loadRoles(); return }
    ElMessage.error(res.message || '添加失败')
  } catch {
    roles.value.unshift({ roleID: 'R' + Date.now(), roleName: roleForm.roleName, isDel: false, memo: roleForm.memo || '' })
    ElMessage.success('角色添加成功（本地）'); roleFormVisible.value = false
  }
}

function handleToggleRoleStatus(row) {
  const isDel = row.isDel
  ElMessageBox.confirm(
    isDel ? `确定要启用角色「${row.roleName}」吗？` : `确定要禁用角色「${row.roleName}」吗？`,
    isDel ? '启用角色' : '禁用角色',
    { type: 'warning', confirmButtonText: isDel ? '确定启用' : '确定禁用' }
  ).then(async () => {
    try {
      const res = await apiPut('UpdateRoleStatus', { roleId: row.roleId || row.roleID, isDel: !isDel })
      if (res.success) { ElMessage.success(isDel ? '角色已启用' : '角色已禁用'); await loadRoles(); return }
      ElMessage.error(res.message || '操作失败')
    } catch {
      row.isDel = !isDel
      ElMessage.success(isDel ? '角色已启用（本地）' : '角色已禁用（本地）')
    }
  }).catch(() => {})
}

function handleDeleteRole(row) {
  ElMessageBox.confirm(`确定要删除角色「${row.roleName}」吗？\n该操作会将角色标记为已删除。`, '删除角色',
    { type: 'warning', confirmButtonText: '确定删除' }
  ).then(async () => {
    try {
      const res = await apiDelete(`DeleteRole/${row.roleId || row.roleID}`)
      if (res.success) { ElMessage.success('角色已删除'); await loadRoles(); return }
      ElMessage.error(res.message || '删除失败')
    } catch {
      roles.value = roles.value.filter(r => (r.roleId || r.roleID) !== (row.roleId || row.roleID))
      ElMessage.success('角色已删除（本地）')
    }
  }).catch(() => {})
}

// ==================== 查看角色内的用户 ====================
const users = ref([])
const userRoles = ref([])
const roleUsersDialogVisible = ref(false)
const selectedRole = ref(null)

async function loadUsers() {
  try {
    const res = await apiGet('GetUsers')
    if (res.success && res.data?.length) { users.value = res.data; return }
  } catch { /* 降级 */ }
  if (users.value.length === 0) users.value = JSON.parse(JSON.stringify(MOCK_USERS))
}

async function loadUserRoles() {
  try {
    const res = await apiGet('GetUserRoles')
    if (res.success && res.data?.length) { userRoles.value = res.data; return }
  } catch { /* 降级 */ }
  if (userRoles.value.length === 0) userRoles.value = JSON.parse(JSON.stringify(MOCK_USER_ROLES))
}

function getUsersByRoleId(roleId) {
  const userIds = userRoles.value.filter(ur => ur.roleID === roleId).map(ur => ur.userID)
  return users.value.filter(u => userIds.includes(u.id))
}

function openRoleUsersDialog(role) { selectedRole.value = role; roleUsersDialogVisible.value = true }

async function handleRemoveFromRole(user, roleId) {
  ElMessageBox.confirm(`确定将「${user.userName}」从角色「${selectedRole.value?.roleName}」中移除吗？`, '移除用户',
    { type: 'warning', confirmButtonText: '确定移除' }
  ).then(async () => {
    try {
      const res = await apiDelete('RemoveUserFromRole', { userID: user.id, roleID: roleId })
      if (res.success) { ElMessage.success('用户已从角色移除'); await loadUserRoles(); return }
      ElMessage.error(res.message || '移除失败')
    } catch {
      userRoles.value = userRoles.value.filter(ur => !(ur.userID === user.id && ur.roleID === roleId))
      ElMessage.success('用户已从角色移除（本地）')
    }
  }).catch(() => {})
}

onMounted(() => { loadRoles(); loadUsers(); loadUserRoles() })
</script>

<template>
  <div class="layout">
    <AppSidebar />
    <div class="main">
      <div class="header">
        <h3>角色管理</h3>
        <Logout />
      </div>
      <div class="content">
        <el-card shadow="never">
          <div class="toolbar">
            <span style="color: #999; font-size: 13px;">共 {{ roles.length }} 个角色</span>
            <el-button type="primary" @click="openAddRole"><el-icon><Plus /></el-icon> 添加角色</el-button>
          </div>
          <el-table :data="roles" v-loading="roleLoading" stripe border style="width: 100%">
            <el-table-column prop="roleName" label="角色名称" min-width="160" />
            <el-table-column label="状态" width="80" align="center">
              <template #default="{ row }"><el-tag :type="row.isDel ? 'danger' : 'success'" size="small">{{ row.isDel ? '禁用' : '启用' }}</el-tag></template>
            </el-table-column>
            <el-table-column label="操作" width="280" align="center">
              <template #default="{ row }">
                <el-button type="primary" link size="small" @click="openRoleUsersDialog(row)">查看用户</el-button>
                <el-button :type="row.isDel ? 'success' : 'danger'" link size="small" @click="handleToggleRoleStatus(row)">{{ row.isDel ? '启用' : '禁用' }}</el-button>
                <el-button :disabled="!row.isDel" type="danger" link size="small" @click="handleDeleteRole(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </div>
    </div>

    <el-dialog title="添加角色" v-model="roleFormVisible" width="420px" :close-on-click-modal="false">
      <el-form label-width="80px" label-position="left">
        <el-form-item label="角色名称" required><el-input v-model="roleForm.roleName" placeholder="请输入角色名称" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="roleForm.memo" type="textarea" :rows="3" placeholder="可选备注信息" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="roleFormVisible = false">取消</el-button>
        <el-button type="primary" @click="submitRole">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog title="角色用户" v-model="roleUsersDialogVisible" width="480px" :close-on-click-modal="false">
      <p style="margin-bottom: 14px; color: #333;">角色：<strong>{{ selectedRole?.roleName }}</strong></p>
      <el-table :data="getUsersByRoleId(selectedRole?.roleId || selectedRole?.roleID)" stripe border style="width: 100%">
        <el-table-column type="index" label="序号" width="60" align="center" />
        <el-table-column prop="userName" label="昵称" min-width="100" />
        <el-table-column prop="userCode" label="账号" min-width="100" />
        <el-table-column label="状态" width="80" align="center">
          <template #default="{ row }"><el-tag :type="row.isDel ? 'danger' : 'success'" size="small">{{ row.isDel ? '禁用' : '启用' }}</el-tag></template>
        </el-table-column>
        <el-table-column label="操作" width="80" align="center">
          <template #default="{ row }">
            <el-button type="danger" link size="small" @click="handleRemoveFromRole(row, selectedRole?.roleId || selectedRole?.roleID)">移除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <p v-if="!selectedRole || getUsersByRoleId(selectedRole.roleId || selectedRole.roleID).length === 0" style="color: #999; text-align: center; padding: 20px 0;">该角色下暂无用户</p>
      <template #footer><el-button @click="roleUsersDialogVisible = false">关闭</el-button></template>
    </el-dialog>
  </div>
</template>

<style scoped>
.layout { display: flex; min-height: 100vh; }
.main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.header { height: 60px; background: #fff; padding: 0 20px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #eee; }
.content { padding: 20px; flex: 1; overflow-y: auto; background: #f0f2f5; }
.toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; gap: 12px; flex-wrap: wrap; }
</style>
