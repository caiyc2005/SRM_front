<template>
  <div class="login-container">
    <div class="login-box">
      <h2>用户登录</h2>

      <!-- 登录表单 -->
      <form @submit.prevent="handleLogin">
        <div class="form-item">
          <label>账号</label>
          <input
            v-model="loginForm.userCode"
            type="text"
            placeholder="请输入账号"
            autocomplete="off"
          />
          <span class="error-tip" v-if="errorMsg.userCode">
            {{ errorMsg.userCode }}
          </span>
        </div>

        <div class="form-item">
          <label>密码</label>
          <input
            v-model="loginForm.password"
            type="password"
            placeholder="请输入密码"
            autocomplete="new-password"
          />
          <span class="error-tip" v-if="errorMsg.password">
            {{ errorMsg.password }}
          </span>
        </div>

        <!-- 登录按钮 -->
        <button type="submit" class="login-btn" :disabled="loading">
          <span v-if="!loading">登录</span>
          <span v-else>登录中...</span>
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
// import { MOCK_USERS } from '@/mock/userData'

const router = useRouter()

// 登录表单数据
const loginForm = reactive({
  userCode: '',
  password: ''
})

// 错误提示
const errorMsg = reactive({
  userCode: '',
  password: ''
})

// 加载状态
const loading = ref(false)

// 表单验证
const validate = () => {
  let valid = true
  errorMsg.userCode = ''
  errorMsg.password = ''

  if (!loginForm.userCode.trim()) {
    errorMsg.userCode = '账号不能为空'
    valid = false
  }

  if (!loginForm.password) {
    errorMsg.password = '密码不能为空'
    valid = false
  } 
  // else if (loginForm.password.length < 6) {
  //   errorMsg.password = '密码长度不能少于6位'
  //   valid = false
  // }

  return valid
}

// 登录提交
const handleLogin = async () => {
  if (!validate()) return

  loading.value = true

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userCode: loginForm.userCode,
        password: loginForm.password
      })
    })

    const result = await response.json()

    if (result.success) {
      // 登录成功 — 保存 token、用户信息、角色
      localStorage.setItem('token', result.token)
      localStorage.setItem('userInfo', JSON.stringify(result.user))
      if (result.user?.roles) {
        localStorage.setItem('userRoles', JSON.stringify(result.user.roles))
      }
      router.push('/welcome')
    } else {
      alert(result.message || '账号或密码错误')
    }

  } catch (err) {
    console.error('后端连接失败:', err.message)
    alert('无法连接到服务器，请检查网络或联系管理员')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  width: 100%;
  height: 100vh;
  background-color: #f5f7fa;
  display: flex;
  justify-content: center;
  align-items: center;
}

.login-box {
  width: 400px;
  padding: 40px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.login-box h2 {
  text-align: center;
  margin-bottom: 30px;
  color: #333;
}

.form-item {
  margin-bottom: 20px;
}

.form-item label {
  display: block;
  margin-bottom: 8px;
  color: #666;
}

.form-item input {
  width: 100%;
  height: 40px;
  padding: 0 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  outline: none;
  box-sizing: border-box;
}

.form-item input:focus {
  border-color: #409eff;
}

.error-tip {
  color: #f56c6c;
  font-size: 12px;
  margin-top: 4px;
  display: block;
}

.login-btn {
  width: 100%;
  height: 44px;
  background-color: #409eff;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  margin-top: 10px;
}

.login-btn:disabled {
  background-color: #a0cfff;
  cursor: not-allowed;
}
</style>