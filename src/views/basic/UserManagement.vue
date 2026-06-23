<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import AppSidebar from '@/components/AppSidebar.vue'
import Logout from '@/components/Logout.vue'

// ==================== API 基础路径 ====================
const API_BASE = '/api/User'

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
async function apiPut(action, body) { return request('PUT', action, body) }
async function apiDelete(action, body) { return request('DELETE', action, body) }

// ==================== 用户管理 ====================
const users = ref([])
const userQuery = reactive({ keyword: '' })
const userLoading = ref(false)
const userFormVisible = ref(false)
const userFormTitle = ref('')
const userForm = reactive({ userID: '', userCode: '', userName: '', password: '', memo: '' })
const isEditUser = ref(false)

async function loadUsers() {
  userLoading.value = true
  try {
    const res = await apiGet('GetUsers')
    if (res.success && res.data?.length) { users.value = res.data; userLoading.value = false; return }
  } catch { /* 降级 */ }
  userLoading.value = false
}

const filteredUsers = computed(() => {
  if (!userQuery.keyword) return users.value
  const kw = userQuery.keyword.toLowerCase()
  return users.value.filter(u =>
    u.userCode?.toLowerCase().includes(kw) || u.userName?.toLowerCase().includes(kw)
  )
})

function openAddUser() {
  isEditUser.value = false; userFormTitle.value = '添加用户'
  Object.assign(userForm, { userID: '', userCode: '', userName: '', password: '', memo: '' })
  userFormVisible.value = true
}

function openEditUser(row) {
  isEditUser.value = true; userFormTitle.value = '修改用户'
  Object.assign(userForm, { userID: row.userID, userCode: row.userCode, userName: row.userName, password: '', memo: row.memo || '' })
  userFormVisible.value = true
}

async function submitUser() {
  if (!userForm.userCode.trim()) { ElMessage.warning('账号不能为空'); return }
  if (!userForm.userName.trim()) { ElMessage.warning('昵称不能为空'); return }
  if (!isEditUser.value && !userForm.password.trim()) { ElMessage.warning('密码不能为空'); return }
  try {
    const body = { userID: userForm.userID, userCode: userForm.userCode, userName: userForm.userName, memo: userForm.memo }
    let res
    if (isEditUser.value) {
      if (userForm.password.trim()) body.password = userForm.password
      res = await apiPut('UpdateUser', body)
    } else {
      res = await apiPost('AddUser', { ...body, password: userForm.password })
    }
    if (res.success) {
      ElMessage.success(isEditUser.value ? '用户修改成功' : '用户添加成功')
      userFormVisible.value = false; await loadUsers(); return
    }
    ElMessage.error(res.message || '操作失败')
  } catch {
    if (isEditUser.value) {
      const idx = users.value.findIndex(u => u.userID === userForm.userID)
      if (idx >= 0) users.value[idx] = { ...users.value[idx], ...userForm }
    } else {
      users.value.unshift({ userID: 'USR' + String(Date.now()).slice(-6), userCode: userForm.userCode, userName: userForm.userName, isDel: false, memo: userForm.memo || '' })
    }
    ElMessage.success(isEditUser.value ? '用户修改成功（本地）' : '用户添加成功（本地）')
    userFormVisible.value = false
  }
}

// ==================== 禁用用户（不可逆） ====================
function handleDeleteUser(row) {
  ElMessageBox.confirm(
    `确定要禁用用户「${row.userName}」吗？禁用后该用户将无法登录系统。`,
    '禁用用户',
    { type: 'warning', confirmButtonText: '确定禁用' }
  ).then(async () => {
    try {
      const res = await apiPost(`DeleteUser?id=${row.userID}`)
      if (res.success) { ElMessage.success('用户已禁用'); await loadUsers(); return }
      ElMessage.error(res.message || '操作失败')
    } catch {
      row.isDel = true
      ElMessage.success('用户已禁用（本地）')
    }
  }).catch(() => {})
}

// ==================== 角色关联 ====================
const roles = ref([])
const userRoles = ref([])
const assignDialogVisible = ref(false)
const assignTargetUser = ref(null)
const checkedRoles = ref([])

async function loadRoles() {
  try {
    const res = await apiGet('GetRoles')
    if (res.success && res.data?.length) { roles.value = res.data; return }
  } catch { /* 降级 */ }
}

async function loadUserRoles() {
  try {
    const res = await apiGet('GetUserRoles')
    if (res.success && res.data?.length) { userRoles.value = res.data; return }
  } catch { /* 降级 */ }
}

function getUserRoleIds(userId) {
  return userRoles.value.filter(ur => ur.userID === userId).map(ur => ur.roleID)
}

function getRoleName(roleId) {
  const r = roles.value.find(item => (item.roleId || item.roleID) === roleId)
  return r ? r.roleName : roleId
}

function openAssignDialog(user) {
  assignTargetUser.value = user
  checkedRoles.value = [...getUserRoleIds(user.userID)]
  assignDialogVisible.value = true
}

async function submitAssign() {
  if (!assignTargetUser.value) return
  const userId = assignTargetUser.value.userID
  const oldRoleIds = getUserRoleIds(userId)
  const newRoleIds = checkedRoles.value
  const toAdd = newRoleIds.filter(id => !oldRoleIds.includes(id))
  const toRemove = oldRoleIds.filter(id => !newRoleIds.includes(id))
  try {
    const tasks = [
      ...toAdd.map(roleID => apiPost('AddUserToRole', { userID: userId, roleID })),
      ...toRemove.map(roleID => apiDelete('RemoveUserFromRole', { userID: userId, roleID }))
    ]
    const results = await Promise.all(tasks)
    if (results.some(r => !r.success)) { ElMessage.warning('部分操作未成功，请检查'); return }
    ElMessage.success('角色分配已更新'); assignDialogVisible.value = false; await loadUserRoles()
  } catch {
    userRoles.value = userRoles.value.filter(ur => ur.userID !== userId)
    toAdd.forEach(roleID => userRoles.value.push({ id: 'UR' + Date.now(), userID: userId, roleID }))
    ElMessage.success('角色分配已更新（本地）'); assignDialogVisible.value = false
  }
}

async function handleRemoveRole(userId, roleID) {
  const roleName = getRoleName(roleID)
  ElMessageBox.confirm(`确定将该用户从角色「${roleName}」中移除吗？`, '移除角色',
    { type: 'warning', confirmButtonText: '确定移除' }
  ).then(async () => {
    try {
      const res = await apiDelete('RemoveUserFromRole', { userID: userId, roleID })
      if (res.success) { ElMessage.success('角色已移除'); await loadUserRoles(); return }
      ElMessage.error(res.message || '移除失败')
    } catch {
      userRoles.value = userRoles.value.filter(ur => !(ur.userID === userId && ur.roleID === roleID))
      ElMessage.success('角色已移除（本地）')
    }
  }).catch(() => {})
}

onMounted(() => { loadUsers(); loadRoles(); loadUserRoles() })
</script>

<template>
  <div class="layout">
    <AppSidebar />
    <div class="main">
      <div class="header">
        <h3>用户管理</h3>
        <Logout />
      </div>
      <div class="content">
        <el-card shadow="never">
          <div class="toolbar">
            <el-input v-model="userQuery.keyword" placeholder="按账号或姓名搜索" clearable style="width: 260px" @input="loadUsers" />
            <el-button type="primary" @click="openAddUser"><el-icon><Plus /></el-icon> 添加用户</el-button>
          </div>
          <el-table :data="filteredUsers" v-loading="userLoading" stripe border style="width: 100%">
            <el-table-column prop="userCode" label="账号" min-width="120" />
            <el-table-column prop="userName" label="昵称" min-width="110" />
            <el-table-column label="已分配角色" min-width="260">
              <template #default="{ row }">
                <el-tag v-for="roleId in getUserRoleIds(row.userID)" :key="roleId" closable type="primary" style="margin: 2px 4px 2px 0;" @close="handleRemoveRole(row.userID, roleId)">{{ getRoleName(roleId) }}</el-tag>
                <span v-if="getUserRoleIds(row.userID).length === 0" style="color: #999; font-size: 13px;">暂未分配</span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="80" align="center">
              <template #default="{ row }"><el-tag :type="row.isDel ? 'danger' : 'success'" size="small">{{ row.isDel ? '禁用' : '启用' }}</el-tag></template>
            </el-table-column>
            <el-table-column label="操作" width="240" align="center" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" link size="small" @click="openEditUser(row)">修改</el-button>
                <el-button type="primary" link size="small" @click="openAssignDialog(row)">分配角色</el-button>
                <el-button :disabled="row.isDel" type="danger" link size="small" @click="handleDeleteUser(row)">禁用</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </div>
    </div>

    <el-dialog :title="userFormTitle" v-model="userFormVisible" width="460px" :close-on-click-modal="false">
      <el-form label-width="80px" label-position="left">
        <el-form-item label="昵称" required><el-input v-model="userForm.userName" placeholder="请输入昵称" /></el-form-item>
        <el-form-item label="账号" required><el-input v-model="userForm.userCode" placeholder="请输入账号" :disabled="isEditUser" /></el-form-item>
        <el-form-item :label="isEditUser ? '新密码' : '密码'" :required="!isEditUser">
          <el-input v-model="userForm.password" type="password" :placeholder="isEditUser ? '留空则不修改' : '请输入密码'" show-password />
        </el-form-item>
        <el-form-item label="备注"><el-input v-model="userForm.memo" type="textarea" :rows="3" placeholder="可选备注信息" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="userFormVisible = false">取消</el-button>
        <el-button type="primary" @click="submitUser">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog title="分配角色" v-model="assignDialogVisible" width="460px" :close-on-click-modal="false">
      <p style="margin-bottom: 16px; color: #333;">为 <strong>{{ assignTargetUser?.userName }}</strong> 分配角色：</p>
      <el-checkbox-group v-model="checkedRoles">
        <el-checkbox v-for="r in roles" :key="r.roleId || r.roleID" :label="r.roleId || r.roleID" :disabled="r.isDel" style="display: flex; margin-bottom: 10px;">
          {{ r.roleName }}
          <el-tag v-if="r.isDel" size="small" type="danger" style="margin-left: 8px;">已停用</el-tag>
          <span v-if="!r.isDel && r.memo" style="color: #999; margin-left: 8px; font-size: 12px;">（{{ r.memo }}）</span>
        </el-checkbox>
      </el-checkbox-group>
      <p v-if="roles.length === 0" style="color: #999; text-align: center;">暂无可用角色，请先添加角色</p>
      <template #footer>
        <el-button @click="assignDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitAssign">保存</el-button>
      </template>
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
