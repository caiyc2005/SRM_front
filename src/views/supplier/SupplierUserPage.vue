<script setup>
/**
 * SupplierUserPage.vue — 供应商子账号管理
 *
 * 功能：供应商主账号查看和新增自己名下的子用户
 */
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import AppSidebar from '@/components/AppSidebar.vue'
import Logout from '@/components/Logout.vue'

const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}')
const noPermission = !userInfo.isMainAccount

const supplierUsers = ref([])
const loadingUsers = ref(false)
const addUserDialogVisible = ref(false)
const addUserLoading = ref(false)
const userForm = reactive({
  userCode: '',
  userName: '',
  memo: ''
})

function resetUserForm() {
  userForm.userCode = ''
  userForm.userName = ''
  userForm.memo = ''
}

async function loadSupplierUsers() {
  const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}')
  if (!userInfo.supplierID) { ElMessage.warning('无法获取供应商信息'); return }
  loadingUsers.value = true
  try {
    const token = localStorage.getItem('token')
    const res = await fetch('/api/Supplier/GetSupplierUsers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': 'Bearer ' + token } : {}) },
      body: JSON.stringify({ supplierID: userInfo.supplierID })
    })
    const text = await res.text()
    const result = text ? JSON.parse(text) : {}
    supplierUsers.value = (result.success && Array.isArray(result.data)) ? result.data : []
  } catch { supplierUsers.value = [] }
  finally { loadingUsers.value = false }
}

function openAddUser() {
  resetUserForm()
  addUserDialogVisible.value = true
}

async function submitAddUser() {
  if (!userForm.userCode.trim()) { ElMessage.warning('登录账号不能为空'); return }
  if (!userForm.userName.trim()) { ElMessage.warning('用户姓名不能为空'); return }
  addUserLoading.value = true
  try {
    const token = localStorage.getItem('token')
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}')
    const res = await fetch('/api/Supplier/CreateSubAccount', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': 'Bearer ' + token } : {}) },
      body: JSON.stringify({
        supplierID: userInfo.supplierID,
        userCode: userForm.userCode.trim(),
        userName: userForm.userName.trim(),
        memo: userForm.memo.trim()
      })
    })
    const text = await res.text()
    const result = text ? JSON.parse(text) : {}
    if (result.success) {
      addUserDialogVisible.value = false
      ElMessageBox.alert(
        '<div style="text-align: center;">' +
          '<div style="font-size: 16px; font-weight: 600; color: #67c23a; margin-bottom: 12px;">用户创建成功</div>' +
          '<div style="display: flex; justify-content: center; gap: 40px; margin-bottom: 8px;">' +
            '<div><div style="font-size: 12px; color: #909399;">登录账号</div>' +
            '<div style="font-size: 18px; font-weight: 700;">' + userForm.userCode + '</div></div>' +
            '<div><div style="font-size: 12px; color: #909399;">默认密码</div>' +
            '<div style="font-size: 18px; font-weight: 700;">123456</div></div>' +
          '</div>' +
          '<div style="font-size: 13px; color: #909399;">请提醒用户及时修改密码</div>' +
        '</div>',
        '创建成功',
        { dangerouslyUseHTMLString: true, type: 'success', confirmButtonText: '知道了' }
      )
      await loadSupplierUsers()
      return
    }
    ElMessage.error(result.message || '创建失败')
  } catch {
    ElMessage.error('创建失败，后端不可用')
  } finally {
    addUserLoading.value = false
  }
}

onMounted(() => {
  if (!noPermission) loadSupplierUsers()
})
</script>

<template>
  <div class="layout">
    <AppSidebar />

    <div class="main">
      <div class="header">
        <h3>供应商子账号管理</h3>
        <Logout />
      </div>

      <div class="content">
        <div v-if="noPermission" style="margin-top: 60px;">
          <el-empty description="当前账号无权限管理供应商子账号，请联系供应商主账号" />
        </div>
        <template v-else>
        <el-card shadow="never">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <span style="font-weight: bold; color: #333; font-size: 15px;">子用户列表</span>
            <el-button type="primary" size="small" @click="openAddUser">
              <el-icon><Plus /></el-icon> 新增子用户
            </el-button>
          </div>

          <el-table :data="supplierUsers" v-loading="loadingUsers" stripe border size="small" style="width: 100%">
            <el-table-column type="index" label="序号" width="60" align="center" />
            <el-table-column prop="userCode" label="登录账号" min-width="120" align="center" />
            <el-table-column prop="userName" label="用户姓名" min-width="120" align="center" />
            <el-table-column prop="memo" label="备注" min-width="160" show-overflow-tooltip />
          </el-table>

          <div v-if="supplierUsers.length === 0 && !loadingUsers" style="text-align: center; padding: 60px 0; color: #999;">
            暂无子用户，点击右上角「新增子用户」添加
          </div>
        </el-card>
        </template>
      </div>
    </div>

    <!-- 新增用户弹窗 -->
    <el-dialog :model-value="addUserDialogVisible" title="新增供应商用户" width="450px" :close-on-click-modal="false" @update:model-value="addUserDialogVisible = $event">
      <el-form :model="userForm" label-width="90px" label-position="left">
        <el-form-item label="登录账号" required>
          <el-input v-model="userForm.userCode" placeholder="请输入登录账号" maxlength="50" />
        </el-form-item>
        <el-form-item label="用户姓名" required>
          <el-input v-model="userForm.userName" placeholder="请输入用户姓名" maxlength="50" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="userForm.memo" type="textarea" :rows="3" placeholder="选填" maxlength="100" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addUserDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="addUserLoading" @click="submitAddUser">确认创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.layout { display: flex; min-height: 100vh; }
.main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.header { height: 60px; background: #fff; padding: 0 20px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #eee; }
.content { padding: 20px; flex: 1; overflow-y: auto; background: #f0f2f5; }
</style>
