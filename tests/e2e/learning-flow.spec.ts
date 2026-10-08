import { test, expect, type Page } from '@playwright/test'

/**
 * 学习全流程 E2E
 *
 * ⚠️ 2026-10-08 修复记录（HANDOVER §13 B-21）：这份用例此前**从未真正跑过** ——
 * 它一直因为 lint job 红而被 CI skip，直到 2026-10-08 首次执行才发现三处硬伤：
 *
 * 1. **未登录态就断言侧边栏**：`/` 在未登录时只渲染 `<Login />`（见 src/App.tsx:87），
 *    `.ant-menu-item` 数量恒为 0 → 「侧边栏导航」必挂，而依赖菜单的其余用例
 *    在 `count = 0` 上循环空转（点了 0 次却断言「无 JS 错误」）→ **假通过**。
 *    修法：`login()` 助手在 beforeEach 里真实登录（storageState 亦可，这里为可读性用 UI 登录）。
 * 2. **按钮文本选择器匹配不到**：Ant Design 会给「两个汉字」的按钮插入空格，
 *    「登录」在 DOM 里是「登 录」，所以 `button:has-text("登录")` 永远匹配不到 →
 *    表现为 `locator.click: Test timeout of 30000ms exceeded`。
 *    修法：本轮统一用 `btn()` 助手（按 role + 容忍空格的正则）。
 * 3. **密码错误**：预置学生账号是 `student1 / student123`（见 src/pages/Login.tsx 底部提示），
 *    旧用例填的是 `123456`，即使点击成功也只会得到「用户名或密码错误」。
 *
 * 另：学生首次登录会弹出「信息登记」Modal（`closable=false` + `maskClosable=false`，
 * 见 src/App.tsx），它会**遮挡整个界面**，不处理掉后续所有点击都会被拦截。`login()` 里点「跳过」。
 */

/** 预置账号（src/context/AuthContext.tsx 的 defaultUsers） */
const STUDENT = { username: 'student1', password: 'student123' }

/**
 * 容忍 Ant Design 的按钮空格：把「登录」转成 /登\s*录/。
 * 不要退回 `button:has-text("登录")` —— 那是本次修复前的写法，匹配不到。
 */
function btn(page: Page, text: string) {
  const pattern = new RegExp(text.split('').join('\\s*'))
  return page.getByRole('button', { name: pattern })
}

/** 真实走一遍登录（含学生首次登录的「信息登记」弹窗处理），返回后侧边栏已就绪 */
async function login(page: Page, user = STUDENT) {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('tab', { name: '登录' })).toBeVisible({ timeout: 30000 })
  await page.getByPlaceholder('用户名').fill(user.username)
  await page.getByPlaceholder('密码').fill(user.password)
  await btn(page, '登录').click()

  // 学生首次登录（本地无 profile）会弹出「信息登记」Modal，它带遮罩且 closable=false，
  // **不处理掉后面所有点击都会被 `<div class="ant-modal-wrap">` 拦截**
  // （实测报错：`… from <div>…</div> subtree intercepts pointer events`）。
  //
  // 踩过的两个坑（都别退回去）：
  // ① `getByRole('dialog', { name: /信息登记/ })` —— 依赖可访问名，标题里带 emoji，容易静默失配；
  // ② `page.locator('.ant-modal-wrap').first()` + isVisible() —— antd 会把**两个 Modal 的 wrapper
  //    都渲染进 DOM**（关闭的那个是 hidden），`.first()` 常常命中隐藏元素，判断永远为假。
  // 现在改成「直接等『跳过』按钮可点」，这是唯一与实际遮挡物一致的判据。
  try {
    await page.locator('.ant-modal-footer').getByRole('button', { name: /跳\s*过/ }).click({ timeout: 15000 })
    // 「跳过」会写入默认 profile 并 window.location.reload()，等新页面稳定
    await page.waitForLoadState('domcontentloaded')
  } catch {
    // 非学生账号（如 admin）不弹「信息登记」，此处直接继续
  }
  // 侧边栏出现 = 已进入主界面（未登录时应用只渲染登录页）
  await expect(page.locator('.ant-menu-item').first()).toBeVisible({ timeout: 30000 })
}

/** 点击侧边栏中标签包含指定文案的菜单项，并断言它已处于选中态 */
async function gotoMenu(page: Page, label: string) {
  const target = page.locator('.ant-menu-item').filter({ hasText: label }).first()
  await target.click()
  await expect(target).toHaveClass(/ant-menu-item-selected/)
}

test.describe('学习全流程 E2E', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('首页加载 — 仪表盘渲染无报错', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', err => errors.push(err.message))
    await expect(page.locator('.ant-menu-item').first()).toBeVisible()
    await page.waitForTimeout(1500)
    const content = await page.textContent('body')
    expect(content).toBeTruthy()
    expect(content).toContain('学习智能体')
    expect(errors).toHaveLength(0)
  })

  test('侧边栏导航 — 可点击切换页面', async ({ page }) => {
    const menuItems = page.locator('.ant-menu-item')
    const count = await menuItems.count()
    expect(count).toBeGreaterThan(0)

    // 点第 2 个菜单项，断言选中态切换（真断言：此前 count 恒为 0，循环根本不执行）
    if (count > 1) {
      await menuItems.nth(1).click()
      await expect(menuItems.nth(1)).toHaveClass(/ant-menu-item-selected/)
    }
  })

  test('页面切换不报错', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', err => errors.push(err.message))

    const menuItems = page.locator('.ant-menu-item')
    const count = await menuItems.count()
    expect(count).toBeGreaterThan(0)

    for (let i = 0; i < Math.min(count, 4); i++) {
      await menuItems.nth(i).click()
      await page.waitForTimeout(500)
    }

    expect(errors).toHaveLength(0)
  })

  // ==================== 登录流程 ====================

  test('登录流程 — 默认学生账号可登录', async ({ page }) => {
    // beforeEach 已用 student1/student123 登录，这里断言「登录确实生效」而不是「body 有文本」
    await expect(page.locator('.ant-menu-item').first()).toBeVisible()
    await expect(page.locator('.ant-avatar')).toBeVisible()
    // 顶栏显示的是用户姓名（预置学生账号的 name 是「张三」，不是用户名 student1）
    await expect(page.getByText('张三')).toBeVisible()
  })

  // ==================== 页面内容验证 ====================

  test('Practice 页面 — 题目列表可交互', async ({ page }) => {
    await gotoMenu(page, '练习')
    const content = await page.textContent('body')
    expect(content).toBeTruthy()
  })

  test('Tutor 页面 — 输入框可交互', async ({ page }) => {
    await gotoMenu(page, '辅导')
    // 辅导页的核心是提问输入区，断言它真的渲染出来（而非空断言 body）
    await expect(page.locator('textarea, input[type="text"]').first()).toBeVisible({ timeout: 15000 })
  })

  test('Profile 页面 — 画像展示', async ({ page }) => {
    await gotoMenu(page, '画像')
    const content = await page.textContent('body')
    expect(content).toBeTruthy()
  })

  test('Path 页面 — 学习路径展示', async ({ page }) => {
    await gotoMenu(page, '路径')
    const content = await page.textContent('body')
    expect(content).toBeTruthy()
  })

  test('Assessment 页面 — 评估报告展示', async ({ page }) => {
    await gotoMenu(page, '评估')
    const content = await page.textContent('body')
    expect(content).toBeTruthy()
  })

  // ==================== 全页面遍历 ====================

  test('全页面遍历 — 点击所有菜单项无 JS 错误', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', err => errors.push(err.message))

    const menuItems = page.locator('.ant-menu-item')
    const count = await menuItems.count()
    // 这一条断言是「遍历真的发生了」的前提：count 为 0 时下面的循环是空转，属假通过
    expect(count).toBeGreaterThan(0)

    for (let i = 0; i < count; i++) {
      await menuItems.nth(i).click()
      await page.waitForTimeout(800)
    }

    expect(errors).toHaveLength(0)
  })
})
