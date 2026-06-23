# 接口权限清单

> 前端所有 API 调用汇总，用于后端配置接口权限。
> 代理规则：`/api/*` → `https://localhost:7221/*`（`/api` 前缀被剥离）

---

## 1. 登录认证

| # | 方法 | 接口路径 | 用途 | 涉及文件 |
|---|------|---------|------|---------|
| 1 | POST | `/api/login` | 用户登录 | Login.vue |

---

## 2. 供应商管理

| # | 方法 | 接口路径 | 用途 | 涉及文件 |
|---|------|---------|------|---------|
| 2 | POST | `/api/Supplier/GetAllSuppliers` | 查询所有供应商 | SupplierPage, ShipPage, ReceivePage, DeliveryPage, OrderPage, CreateOrderPage |
| 3 | POST | `/api/Supplier/AddSupplier` | 新增供应商 | SupplierPage |
| 4 | POST | `/api/Supplier/UpdateSupplier` | 修改供应商 | SupplierPage |
| 5 | POST | `/api/Supplier/UpdateSupplierStatus` | 启用/禁用供应商 | SupplierPage |

---

## 3. 物料管理

| # | 方法 | 接口路径 | 用途 | 涉及文件 |
|---|------|---------|------|---------|
| 6 | GET | `/api/Materials/GetAll` | 查询所有物料 | MaterialManagement, OrderPage, CreateOrderPage |
| 7 | POST | `/api/Materials/CreateMaterial` | 新增物料 | MaterialManagement |
| 8 | POST | `/api/Materials/UpdateMaterial` | 修改物料 | MaterialManagement |
| 9 | POST | `/api/Materials/DeleteMaterial` | 删除物料 | MaterialManagement |

---

## 4. 采购订单

| # | 方法 | 接口路径 | 用途 | 涉及文件 |
|---|------|---------|------|---------|
| 10 | GET | `/api/Orders/GetOrdersByList` | 分页查询订单（支持状态/供应商/单号筛选） | OrderPage, ReceivePage, AppSidebar |
| 11 | POST | `/api/Orders/CreateOrder` | 创建采购订单 | OrderPage, CreateOrderPage |
| 12 | POST | `/api/Orders/ConfirmOrder` | 确认订单（审核） | OrderPage |

---

## 5. 送货单

| # | 方法 | 接口路径 | 用途 | 涉及文件 |
|---|------|---------|------|---------|
| 13 | POST | `/api/Delivery/GetDeliveryNote` | 分页查询送货单 | DeliveryPage, ReceivePage, ShipPage |
| 14 | POST | `/api/Delivery/CreateDeliveryNote` | 生成送货单 | OrderPage |
| 15 | DELETE | `/api/Delivery/DeleteDeliveryNote/{id}` | 删除送货单 | DeliveryPage |
| 16 | POST | `/api/Delivery/DeliveryConfirm` | 供应商确认发货 | ShipPage |

---

## 6. 收料入库

| # | 方法 | 接口路径 | 用途 | 涉及文件 |
|---|------|---------|------|---------|
| 17 | POST | `/api/Receive/CreateReceive` | 创建收料记录（扫码收料） | ReceivePage |
| 18 | POST | `/api/Receive/GetReceivesList` | 查询收料历史 | ReceivePage |

---

## 7. 仓库管理

| # | 方法 | 接口路径 | 用途 | 涉及文件 |
|---|------|---------|------|---------|
| 19 | GET | `/api/Warehouse/GetAllWarehouse` | 查询所有仓库 | WarehousePage |
| 20 | POST | `/api/Warehouse/GetAllWarehouse` | 查询所有仓库（同 GET） | ReceivePage |
| 21 | POST | `/api/Warehouse/CreateWarehouse` | 新增仓库 | WarehousePage |
| 22 | POST | `/api/Warehouse/UpdateWarehouse` | 修改仓库 | WarehousePage |
| 23 | POST | `/api/Warehouse/SetWarehouseStatus` | 启用/禁用仓库 | WarehousePage |

---

## 8. 库存管理

| # | 方法 | 接口路径 | 用途 | 涉及文件 |
|---|------|---------|------|---------|
| 24 | POST | `/api/Inventory/GetAllFromInventory` | 查询库存列表 | InventoryPage |

---

## 9. 用户与角色

| # | 方法 | 接口路径 | 用途 | 涉及文件 |
|---|------|---------|------|---------|
| 25 | GET | `/api/User/GetUsers` | 查询所有用户 | UserPage, RoleManagement, UserManagement |
| 26 | GET | `/api/User/GetRoles` | 查询所有角色 | UserPage, RoleManagement, UserManagement |
| 27 | GET | `/api/User/GetUserRoles` | 查询用户-角色关联 | UserPage, RoleManagement, UserManagement |
| 28 | POST | `/api/User/AddUser` | 新增用户 | UserPage, UserManagement |
| 29 | PUT | `/api/User/UpdateUser` | 修改用户 | UserPage, UserManagement |
| 30 | POST | `/api/User/AddRole` | 新增角色 | UserPage, RoleManagement |
| 31 | PUT | `/api/User/UpdateRoleStatus` | 启用/禁用角色 | UserPage, RoleManagement |
| 32 | POST | `/api/User/AddUserToRole` | 为用户分配角色 | UserPage, UserManagement |
| 33 | DELETE | `/api/User/RemoveUserFromRole` | 移除用户的角色 | UserPage, RoleManagement, UserManagement |
| 34 | DELETE | `/api/User/DeleteRole/{id}` | 删除角色（路径参数） | UserPage |
| 35 | POST | `/api/User/DeleteRole?id={id}` | 删除角色（查询参数） | RoleManagement |
| 36 | POST | `/api/User/DeleteUser?id={id}` | 禁用/删除用户 | UserManagement |

---

## 汇总

- **接口总数**：36 个
- **模块**：登录、供应商、物料、采购订单、送货单、收料、仓库、库存、用户角色
- **后端地址**：`https://localhost:7221`
- **鉴权方式**：`Authorization: Bearer {token}`（除登录外所有接口）
