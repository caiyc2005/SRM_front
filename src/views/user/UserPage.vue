<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import AppSidebar from '@/components/AppSidebar.vue'
import Logout from '@/components/Logout.vue'

// ==================== API 基础路径 ====================
const API_BASE = '/api/User'

// ==================== 通用 API 调用 ====================
async function request(method, action, body) {
  const opts = {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  }
  const res = await fetch(`${API_BASE}/${action}`, opts)
  // 尝试解析 JSON，若响应为空则返回默认格式
  const text = await res.text()
  if (!text) return { success: false, message: '响应内容为空' }
  try {
    return JSON.parse(text)
  } catch {
    return { success: false, message: '响应格式错误' }
  }
}

async function apiGet(action) {
  return request('GET', action)
}

async function apiPost(action, body) {
  return request('POST', action, body)
}

async function apiPut(action, body) {
  return request('PUT', action, body)
}

async function apiDelete(action, body) {
  const res = await request('DELETE', action, body)
  return res
}

// ==================== 当前活动标签页 ====================
const activeTab = ref('users')

// ==================== 1. 用户管理 ====================
const users = ref([])
const userQuery = reactive({ keyword: '' })
const userLoading = ref(false)

const userFormVisible = ref(false)
const userFormTitle = ref('')
const userForm = reactive({
  id: '',
  userCode: '',
  userName: '',
  password: '',
  memo: ''
})
const isEditUser = ref(false)

async function loadUsers() {
  userLoading.value = true
  try {
    const res = await apiGet('GetUsers')
    if (res.success) {
      users.value = res.data || []
    }
  } catch {
    // 静默失败，保留现有数据
  } finally {
    userLoading.value = false
  }
}

const filteredUsers = computed(() => {
  if (!userQuery.keyword) return users.value
  const kw = userQuery.keyword.toLowerCase()
  return users.value.filter(u =>
    u.userCode?.toLowerCase().includes(kw) ||
    u.userName?.toLowerCase().includes(kw)
  )
})

function openAddUser() {
  isEditUser.value = false
  userFormTitle.value = '添加用户'
  userForm.id = ''
  userForm.userCode = ''
  userForm.userName = ''
  userForm.password = ''
  userForm.memo = ''
  userFormVisible.value = true
}

function openEditUser(row) {
  isEditUser.value = true
  userFormTitle.value = '修改用户'
  userForm.id = row.id
  userForm.userCode = row.userCode
  userForm.userName = row.userName
  userForm.password = ''
  userForm.memo = row.memo || ''
  userFormVisible.value = true
}

async function submitUser() {
  if (!userForm.userCode.trim()) {
    ElMessage.warning('账号不能为空')
    return
  }
  if (!userForm.userName.trim()) {
    ElMessage.warning('昵称不能为空')
    return
  }
  if (!isEditUser.value && !userForm.password.trim()) {
    ElMessage.warning('密码不能为空')
    return
  }

  try {
    let res
    if (isEditUser.value) {
      // 修改用户 —— 只传有值的字段
      const body = { id: userForm.id, userCode: userForm.userCode, userName: userForm.userName, memo: userForm.memo }
      if (userForm.password.trim()) body.password = userForm.password
      res = await apiPut('UpdateUser', body)
    } else {
      // 添加用户
      res = await apiPost('AddUser', {
        userCode: userForm.userCode,
        userName: userForm.userName,
        password: userForm.password,
        memo: userForm.memo
      })
    }

    if (res.success) {
      ElMessage.success(isEditUser.value ? '用户修改成功' : '用户添加成功')
      userFormVisible.value = false
      if (!isEditUser.value && res.data) {
        users.value.unshift(res.data)
      }
      loadUsers()
    } else {
      ElMessage.error(res.message || '操作失败')
    }
  } catch (err) {
    ElMessage.error('请求失败：' + err.message)
  }
}


// ==================== 2. 角色管理 ====================
const roles = ref([])
const roleLoading = ref(false)
const roleFormVisible = ref(false)
const roleForm = reactive({
  id: '',
  roleName: '',
  memo: ''
})

async function loadRoles() {
  roleLoading.value = true
  try {
    const res = await apiGet('GetRoles')
    if (res.success) {
      roles.value = res.data || []
    }
  } catch {
    // 静默失败，保留现有数据
  } finally {
    roleLoading.value = false
  }
}

function openAddRole() {
  roleForm.id = ''
  roleForm.roleName = ''
  roleForm.memo = ''
  roleFormVisible.value = true
}

async function submitRole() {
  if (!roleForm.roleName.trim()) {
    ElMessage.warning('角色名称不能为空')
    return
  }

  try {
    const res = await apiPost('AddRole', {
      roleName: roleForm.roleName,
      memo: roleForm.memo
    })
    if (res.success) {
      ElMessage.success('角色添加成功')
      roleFormVisible.value = false
      if (res.data) {
        roles.value.push(res.data)
      }
      loadRoles()
    } else {
      ElMessage.error(res.message || '添加失败')
    }
  } catch (err) {
    ElMessage.error('请求失败：' + err.message)
  }
}


function handleToggleRoleStatus(row) {
  const isDel = row.isDel
  const title = isDel ? '启用角色' : '禁用角色'
  const message = isDel
    ? `确定要启用角色「${row.roleName}」吗？`
    : `确定要禁用角色「${row.roleName}」吗？`
  const btnText = isDel ? '确定启用' : '确定禁用'

  ElMessageBox.confirm(message, title, {
    type: 'warning',
    confirmButtonText: btnText
  }).then(async () => {
    try {
      const res = await apiPut('UpdateRoleStatus', {
        roleId: row.roleId || row.roleID,
        isDel: !isDel
      })
      if (res.success) {
        ElMessage.success(isDel ? '角色已启用' : '角色已禁用')
        await loadRoles()
      } else {
        ElMessage.error(res.message || '操作失败')
      }
    } catch (err) {
      ElMessage.error('请求失败：' + err.message)
    }
  }).catch(() => {})
}

function handleDeleteRole(row) {
  ElMessageBox.confirm(
    `确定要删除角色「${row.roleName}」吗？\n该操作会将角色标记为已删除。`,
    '删除角色',
    { type: 'warning', confirmButtonText: '确定删除' }
  ).then(async () => {
    try {
      const res = await apiDelete(`DeleteRole/${row.roleId || row.roleID}`)
      if (res.success) {
        ElMessage.success('角色已删除')
        await loadRoles()
      } else {
        ElMessage.error(res.message || '删除失败')
      }
    } catch (err) {
      ElMessage.error('请求失败：' + err.message)
    }
  }).catch(() => {})
}

// ==================== 查看角色内的用户 ====================
const roleUsersDialogVisible = ref(false)
const selectedRole = ref(null)

function getUsersByRoleId(roleId) {
  const userIds = userRoles.value
    .filter(ur => ur.roleID === roleId)
    .map(ur => ur.userID)
  return users.value.filter(u => userIds.includes(u.id))
}

function openRoleUsersDialog(role) {
  selectedRole.value = role
  roleUsersDialogVisible.value = true
}

async function handleRemoveFromRole(user, roleId) {
  ElMessageBox.confirm(
    `确定将「${user.userName}」从角色「${selectedRole.value?.roleName}」中移除吗？`,
    '移除用户',
    { type: 'warning', confirmButtonText: '确定移除' }
  ).then(async () => {
    const res = await apiDelete('RemoveUserFromRole', {
      userID: user.id,
      roleID: roleId
    })
    if (res.success) {
      ElMessage.success('用户已从角色移除')
      await loadUserRoles()
    } else {
      ElMessage.error(res.message || '移除失败')
    }
  }).catch(() => {})
}

// ==================== 3. 用户-角色关联（权限分配） ====================
const userRoles = ref([])
const urLoading = ref(false)
const assignDialogVisible = ref(false)
const assignTargetUser = ref(null)
const checkedRoles = ref([])

async function loadUserRoles() {
  urLoading.value = true
  try {
    const res = await apiGet('GetUserRoles')
    if (res.success) {
      userRoles.value = res.data || []
    }
  } catch {
    // 静默失败，保留现有数据
  } finally {
    urLoading.value = false
  }
}

/** 获取某个用户已分配的角色ID列表（按角色表顺序） */
function getUserRoleIds(userId) {
  const ids = userRoles.value
    .filter(ur => ur.userID === userId)
    .map(ur => ur.roleID)
  // 按角色表 roles 的顺序排序
  return ids.sort((a, b) => {
    const ia = roles.value.findIndex(r => (r.roleId || r.roleID) === a)
    const ib = roles.value.findIndex(r => (r.roleId || r.roleID) === b)
    return ia - ib
  })
}

/** 根据用户ID获取用户名 */
function getUserName(userId) {
  const u = users.value.find(item => item.id === userId)
  return u ? u.userName : userId
}

/** 根据角色ID获取角色名 */
function getRoleName(roleId) {
  const r = roles.value.find(item => (item.roleId || item.roleID) === roleId)
  return r ? r.roleName : roleId
}

/** 打开分配角色弹窗 */
function openAssignDialog(user) {
  assignTargetUser.value = user
  checkedRoles.value = [...getUserRoleIds(user.id)]
  assignDialogVisible.value = true
}

/** 保存角色分配 — 增量更新（只添加/移除变化的） */
async function submitAssign() {
  if (!assignTargetUser.value) return

  const oldRoleIds = getUserRoleIds(assignTargetUser.value.id)
  const newRoleIds = checkedRoles.value

  // 需要添加的角色（新勾选 - 旧已选）
  const toAdd = newRoleIds.filter(id => !oldRoleIds.includes(id))
  // 需要移除的角色（旧已选 - 新勾选）
  const toRemove = oldRoleIds.filter(id => !newRoleIds.includes(id))

  try {
    // 并行执行所有变更
    const tasks = [
      ...toAdd.map(roleID =>
        apiPost('AddUserToRole', {
          userID: assignTargetUser.value.id,
          roleID
        })
      ),
      ...toRemove.map(roleID =>
        apiDelete('RemoveUserFromRole', {
          userID: assignTargetUser.value.id,
          roleID
        })
      )
    ]

    const results = await Promise.all(tasks)
    const hasError = results.some(r => !r.success)

    if (hasError) {
      ElMessage.warning('部分操作未成功，请检查')
    } else {
      ElMessage.success('角色分配已更新')
    }

    assignDialogVisible.value = false
    await loadUserRoles()
  } catch (err) {
    ElMessage.error('请求失败：' + err.message)
  }
}

/** 直接从标签上移除角色 */
async function handleRemoveRole(userId, roleID) {
  const userName = getUserName(userId)
  const roleName = getRoleName(roleID)
  ElMessageBox.confirm(
    `确定将「${userName}」从角色「${roleName}」中移除吗？`,
    '移除角色',
    { type: 'warning', confirmButtonText: '确定移除' }
  ).then(async () => {
    const res = await apiDelete('RemoveUserFromRole', {
      userID: userId,
      roleID
    })
    if (res.success) {
      ElMessage.success('角色已移除')
      await loadUserRoles()
    } else {
      ElMessage.error(res.message || '移除失败')
    }
  }).catch(() => {})
}

// ==================== 生命周期 ====================
onMounted(() => {
  loadUsers()
  loadRoles()
  loadUserRoles()
})
</script>

<template>
  <div class="layout">
    <AppSidebar />

    <div class="main">
      <div class="header">
        <h3>用户信息管理</h3>
        <Logout />
      </div>

      <div class="content">
        <el-card shadow="never">
          <el-tabs v-model="activeTab" class="user-tabs">
            <!-- ========== 标签页1：用户管理 ========== -->
            <el-tab-pane label="👤 用户管理" name="users">
              <div class="toolbar">
                <el-input
                  v-model="userQuery.keyword"
                  placeholder="按账号或姓名搜索"
                  clearable
                  style="width: 260px"
                  @input="loadUsers"
                />
                <el-button type="primary" @click="openAddUser">
                  <el-icon><Plus /></el-icon> 添加用户
                </el-button>
              </div>

              <el-table :data="filteredUsers" v-loading="userLoading" stripe border style="width: 100%">
                <el-table-column prop="userCode" label="账号" min-width="120" />
                <el-table-column prop="userName" label="昵称" min-width="110" />
                <el-table-column label="已分配角色" min-width="260">
                  <template #default="{ row }">
                    <el-tag
                      v-for="roleId in getUserRoleIds(row.id)"
                      :key="roleId"
                      closable
                      type="primary"
                      style="margin: 2px 4px 2px 0;"
                      @close="handleRemoveRole(row.id, roleId)"
                    >
                      {{ getRoleName(roleId) }}
                    </el-tag>
                    <span v-if="getUserRoleIds(row.id).length === 0" style="color: #999; font-size: 13px;">
                      暂未分配
                    </span>
                  </template>
                </el-table-column>
                <el-table-column label="状态" width="80" align="center">
                  <template #default="{ row }">
                    <el-tag :type="row.isDel ? 'danger' : 'success'" size="small">
                      {{ row.isDel ? '禁用' : '启用' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="170" align="center" fixed="right">
                  <template #default="{ row }">
                    <el-button type="primary" link size="small" @click="openEditUser(row)">
                      修改
                    </el-button>
                    <el-button type="primary" link size="small" @click="openAssignDialog(row)">
                      分配角色
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>

            <!-- ========== 标签页2：角色管理 ========== -->
            <el-tab-pane label="🔐 角色管理" name="roles">
              <div class="toolbar">
                <span style="color: #999; font-size: 13px;">共 {{ roles.length }} 个角色</span>
                <el-button type="primary" @click="openAddRole">
                  <el-icon><Plus /></el-icon> 添加角色
                </el-button>
              </div>

              <el-table :data="roles" v-loading="roleLoading" stripe border style="width: 100%">
                <el-table-column prop="roleName" label="角色名称" min-width="160" />
                <el-table-column label="状态" width="80" align="center">
                  <template #default="{ row }">
                    <el-tag :type="row.isDel ? 'danger' : 'success'" size="small">
                      {{ row.isDel ? '禁用' : '启用' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="280" align="center">
                  <template #default="{ row }">
                    <el-button type="primary" link size="small" @click="openRoleUsersDialog(row)">
                      查看用户
                    </el-button>
                    <!-- <el-button :type="row.isDel ? 'success' : 'danger'" link size="small" @click="handleToggleRoleStatus(row)">
                      {{ row.isDel ? '启用' : '禁用' }}
                    </el-button> -->
                    <el-button :disabled="!row.isDel" type="danger" link size="small" @click="handleDeleteRole(row)">
                      删除
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>

	          </el-tabs>
        </el-card>
      </div>
    </div>

    <!-- ========== 添加/修改用户弹窗 ========== -->
    <el-dialog
      :title="userFormTitle"
      v-model="userFormVisible"
      width="460px"
      :close-on-click-modal="false"
    >
      <el-form label-width="80px" label-position="left">
        <el-form-item label="昵称" required>
          <el-input v-model="userForm.userName" placeholder="请输入昵称" />
        </el-form-item>
        <el-form-item label="账号" required>
          <el-input v-model="userForm.userCode" placeholder="请输入账号" :disabled="isEditUser" />
        </el-form-item>
        <el-form-item :label="isEditUser ? '新密码' : '密码'" :required="!isEditUser">
          <el-input
            v-model="userForm.password"
            type="password"
            :placeholder="isEditUser ? '留空则不修改' : '请输入密码'"
            show-password
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="userForm.memo" type="textarea" :rows="3" placeholder="可选备注信息" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="userFormVisible = false">取消</el-button>
        <el-button type="primary" @click="submitUser">确定</el-button>
      </template>
    </el-dialog>

    <!-- ========== 添加角色弹窗 ========== -->
    <el-dialog
      title="添加角色"
      v-model="roleFormVisible"
      width="420px"
      :close-on-click-modal="false"
    >
      <el-form label-width="80px" label-position="left">
        <el-form-item label="角色名称" required>
          <el-input v-model="roleForm.roleName" placeholder="请输入角色名称" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="roleForm.memo" type="textarea" :rows="3" placeholder="可选备注信息" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="roleFormVisible = false">取消</el-button>
        <el-button type="primary" @click="submitRole">确定</el-button>
      </template>
    </el-dialog>

    <!-- ========== 分配角色弹窗 ========== -->
    <el-dialog
      title="分配角色"
      v-model="assignDialogVisible"
      width="460px"
      :close-on-click-modal="false"
    >
      <p style="margin-bottom: 16px; color: #333;">
        为 <strong>{{ assignTargetUser?.userName }}</strong> 分配角色：
      </p>
      <el-checkbox-group v-model="checkedRoles">
        <el-checkbox
          v-for="r in roles"
          :key="r.roleId || r.roleID"
          :label="r.roleId || r.roleID"
          :disabled="r.isDel"
          style="display: flex; margin-bottom: 10px;"
        >
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

    <!-- ========== 查看角色内的用户弹窗 ========== -->
    <el-dialog
      title="角色用户"
      v-model="roleUsersDialogVisible"
      width="480px"
      :close-on-click-modal="false"
    >
      <p style="margin-bottom: 14px; color: #333;">
        角色：<strong>{{ selectedRole?.roleName }}</strong>
      </p>
      <el-table :data="getUsersByRoleId(selectedRole?.roleId || selectedRole?.roleID)" stripe border style="width: 100%">
        <el-table-column type="index" label="序号" width="60" align="center" />
        <el-table-column prop="userName" label="昵称" min-width="100" />
        <el-table-column prop="userCode" label="账号" min-width="100" />
        <el-table-column label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.isDel ? 'danger' : 'success'" size="small">
              {{ row.isDel ? '禁用' : '启用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" align="center">
          <template #default="{ row }">
            <el-button
              type="danger"
              link
              size="small"
              @click="handleRemoveFromRole(row, selectedRole?.roleId || selectedRole?.roleID)"
            >
              移除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <p v-if="!selectedRole || getUsersByRoleId(selectedRole.roleId || selectedRole.roleID).length === 0" style="color: #999; text-align: center; padding: 20px 0;">
        该角色下暂无用户
      </p>
      <template #footer>
        <el-button @click="roleUsersDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.layout { display: flex; min-height: 100vh; }
.main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.header { height: 60px; background: #fff; padding: 0 20px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #eee; }
.content { padding: 20px; flex: 1; overflow-y: auto; background: #f0f2f5; }

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  gap: 12px;
  flex-wrap: wrap;
}

.user-tabs {
  background: #fff;
  padding: 0;
}

/* 覆盖 el-tabs 默认内边距 */
:deep(.el-tabs__content) {
  padding: 16px 0;
}
</style>
