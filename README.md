# 清小转&Deepseek智能对话机器人

本插件用来实现与清小转的全自动对话

## 使用说明

### 🌟 生产环境（强烈推荐）
使用 `button-userscript.js` - **最新按钮图标监控版本**：

#### 步骤 1: 安装脚本
1. 打开 Tampermonkey 扩展（没有Tampermonkey可以安装一下拓展，可自行寻找教程）
2. 点击 "创建新脚本"
3. 复制 `button-userscript.js` 中的完整代码
4. 粘贴并保存脚本

#### 步骤 2: 配置 API Key
1. 访问 [DeepSeek API](https://platform.deepseek.com/) 获取 API Key
目前有一个API可供使用，请联系我我发给你。
2. 在清小搭界面，点击 Tampermonkey 图标
3. 选择 "🔑 配置DeepSeek API Key"
4. 输入您的 API Key 并保存

#### 步骤 3: 开始自动对话
1. 在清华转系咨询页面，点击 Tampermonkey 图标
2. 选择 "🚀 开始自动对话"
3. 输入初始问题（例如："我想转到计算机系，需要做哪些准备？"）
4. 脚本将自动：
   - 发送问题给AI助手
   - 监控按钮图标变化（发送中 → 准备就绪）
   - 提取AI回复
   - 调用DeepSeek生成下一个问题
   - 重复此过程

#### 步骤 4: 监控和控制
- **查看日志**: 打开浏览器控制台 (F12) 查看详细执行日志
- **停止脚本**: 点击 Tampermonkey 图标，选择 "🛑 停止自动对话"

### 🔧 核心特性

#### 精确的状态检测
脚本通过监控发送按钮的图标变化来准确判断对话状态：
```
发送问题 → 检测到"发送中"图标 → 等待 → 检测到"准备就绪"图标 → 提取回复 → 生成下一问题
```

#### 多层次DOM选择器
- 主选择器：`div.chat-message > div.markdown-body`
- 备用选择器：`div.chat-list` 容器查找
- 兜底选择器：全局 `div.markdown-body` 搜索

#### 智能错误恢复
- 60秒超时保护
- 多种消息提取方法
- 自动重试机制

### 备选版本

#### 事件监听版本
使用 `event-userscript.js`（如果按钮监控有问题）：
- 基于控制台日志拦截
- 监听 "stream onclose" 事件
- 适合调试和特殊情况

#### 内容稳定性版本
使用 `stream-userscript.js`（最保守的方法）：
- 基于内容变化检测
- 多次验证确保完整性
- 最稳定但可能较慢

### 调试环境
使用 `debug-userscript.js` 进行页面分析：
1. **分析页面结构**: 菜单选择"🔍 调试页面结构"
2. **测试按钮点击**: 菜单选择"🧪 测试按钮点击"
3. **测试输入填充**: 菜单选择"📝 测试输入框填充"
4. **配置API**: 菜单选择"🔑 配置DeepSeek API Key"

## 开发建议

### 调试技巧
- 使用浏览器开发者工具监控DOM变化
- 检查网络请求确保API调用正常
- 使用Tampermonkey的调试功能

### 最佳实践
- 总是使用try-catch包装关键操作
- 避免直接修改浏览器原生对象
- 使用Tampermonkey提供的GM_*函数
- 实现优雅的错误降级

## 常见问题

### Q: 脚本无法发送消息
A: 检查页面的DOM选择器是否正确，可能需要根据实际页面结构调整

### Q: API调用失败
A: 验证DeepSeek API Key是否正确配置，检查网络连接

### Q: 控制台错误
A: 使用修复版本脚本，它包含了更好的错误处理机制

## 技术栈

- JavaScript (ES6+)
- Tampermonkey API
- DOM Manipulation
- MutationObserver
- Async/Await
- RESTful API调用

## 支持的浏览器

- ✅ Chrome + Tampermonkey
- ✅ Firefox + Tampermonkey
- ✅ Edge + Tampermonkey
- ⚠️ Safari (需要相应的用户脚本管理器)

---

**注意**: 这个脚本专门为清华大学转系咨询网站设计。在其他网站使用前需要相应调整DOM选择器和逻辑。


## 项目文件

### 核心文件
- `original-userscript.js` - 包含错误的原始用户脚本
- `fixed-userscript.js` - 修复后的用户脚本版本（基础修复）
- `stream-userscript.js` - 智能流监听版本（内容稳定性检测）
- `event-userscript.js` - 事件监听版本
- `button-userscript.js` - 按钮图标监控版本（🌟 **最新推荐**）
- `debug-userscript.js` - 调试版本脚本（用于分析页面结构）
- `error-analysis.md` - 详细的错误分析和修复说明

### 配置文件
- `package.json` - 项目配置
- `.github/copilot-instructions.md` - GitHub Copilot指令

## 主要错误

### 第一个错误：Console属性只读
```
Uncaught TypeError: Cannot set property log of [object Object] which has only a getter
```

### 第二个错误：DOM选择器不匹配
发送按钮实际是 `<img>` 元素，而脚本中使用的是 `'button > span > svg'` 选择器

### 第三个错误：时机检测问题
脚本过早检测到回复完成，实际上应该等到 `stream onclose` 事件后才表示真正完成

### 第四个错误：按钮图标状态检测
发送按钮的图标会在不同状态下发生变化，需要监控图标从"发送中"到"准备就绪"的完整转换

从日志可以看出：
```
[UserScript] 检测到按钮状态变为可用，处理回复...
[UserScript] 检测到智能助手回复完毕。
...
stream onclose  // 这时才是真正的流结束
[UserScript] 检测到发送中图标
[UserScript] 检测到图标从发送中变为准备就绪 - 对话已结束 // 🎯 最可靠的检测方式
```

## 错误原因

1. **Console属性只读**: 试图修改只读的console.log属性
2. **缺失函数定义**: 调用了未定义的`startConsoleListener`函数
3. **不安全的控制台操作**: 直接修改console对象导致错误
4. **错误的DOM选择器**: 发送按钮是`<img>`元素，而非`<svg>`
5. **按钮状态检测不完整**: 缺乏完整的禁用状态检测逻辑
6. **时机检测错误**: 过早检测回复完成，应等待流真正结束
7. **图标状态监控缺失**: 未能正确监控按钮图标的状态变化

## 修复方案

### 使用修复版本脚本
1. 复制 `button-userscript.js` 的内容（🌟 **推荐**）
2. 在Tampermonkey中创建新脚本
3. 粘贴修复版本代码
4. 保存并启用脚本

### 主要改进
- ✅ 安全的Logger系统
- ✅ 使用GM_log替代console.log修改
- ✅ 修复了DOM选择器匹配问题
- ✅ 增强的按钮状态检测
- ✅ 改进的输入事件触发
- ✅ **按钮图标状态监控**（🎯 **最新突破**）
- ✅ **精确的对话完成检测**（监控图标变化）
- ✅ **多层次DOM选择器**（兼容性更强）
- ✅ 增强的错误处理
- ✅ 安全的初始化流程
- ✅ 更好的容错机制
- ✅ 调试版本脚本

## 功能特性

- 🤖 自动与DeepSeek API交互
- 💬 智能对话历史管理
- 🔍 DOM变化监控
- ⚡ 安全的异步操作
- 🛡️ 健壮的错误处理

