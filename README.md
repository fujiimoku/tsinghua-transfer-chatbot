# 用户脚本调试工作区

这个工作区专门用于分析和修复JavaScript用户脚本中的错误，特别是Tampermonkey脚本。

## 项目文件

### 核心文件
- `original-userscript.js` - 包含错误的原始用户脚本
- `fixed-userscript.js` - 修复后的用户脚本版本（基础修复）
- `stream-userscript.js` - 智能流监听版本（推荐使用）
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

从日志可以看出：
```
[UserScript] 检测到按钮状态变为可用，处理回复...
[UserScript] 检测到智能助手回复完毕。
...
stream onclose  // 这时才是真正的流结束
```

## 错误原因

1. **Console属性只读**: 试图修改只读的console.log属性
2. **缺失函数定义**: 调用了未定义的`startConsoleListener`函数
3. **不安全的控制台操作**: 直接修改console对象导致错误
4. **错误的DOM选择器**: 发送按钮是`<img>`元素，而非`<svg>`
5. **按钮状态检测不完整**: 缺乏完整的禁用状态检测逻辑
6. **时机检测错误**: 过早检测回复完成，应等待流真正结束

## 修复方案

### 使用修复版本脚本
1. 复制 `fixed-userscript.js` 的内容
2. 在Tampermonkey中创建新脚本
3. 粘贴修复版本代码
4. 保存并启用脚本

### 主要改进
- ✅ 安全的Logger系统
- ✅ 使用GM_log替代console.log修改
- ✅ 修复了DOM选择器匹配问题
- ✅ 增强的按钮状态检测
- ✅ 改进的输入事件触发
- ✅ **智能流结束检测**（新增）
- ✅ **内容稳定性验证**（新增）
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

## 使用说明

### 生产环境（推荐）
使用 `stream-userscript.js` - 智能流监听版本：
1. **配置API Key**: 在Tampermonkey菜单中选择"配置DeepSeek API Key"
2. **开始对话**: 点击"开始自动对话"菜单项
3. **监控执行**: 在浏览器控制台查看日志输出
4. **停止脚本**: 点击"停止自动对话"菜单项

### 基础版本
使用 `fixed-userscript.js` - 基础修复版本（如果流监听版本有问题）

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
