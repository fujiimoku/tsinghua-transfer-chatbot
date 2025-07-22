// ==UserScript==
// @name         清小转 & DeepSeek 自动对话机器人 (调试版)
// @namespace    http://tampermonkey.net/
// @version      1.2-debug
// @description  自动使用DeepSeek API与清华大学转系咨询智能助手进行连续对话 - 调试版本
// @author       Your Name
// @match        https://www.xiaoda.tsinghua.edu.cn/chat/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_log
// @connect      api.deepseek.com
// ==/UserScript==

(function () {
    'use strict';

    // --- 配置区域 ---
    const DEEPSEEK_API_KEY_STORAGE = 'DEEPSEEK_API_KEY';

    // --- UI 选择器 (根据页面实际情况可能需要微调) ---
    const INPUT_SELECTOR = 'textarea[placeholder="输入问题，即刻解答！"]'; // 输入框
    const SEND_BUTTON_SELECTOR = 'img.icon[data-v-7248c752]'; // 发送按钮的图标
    const CHAT_CONTAINER_SELECTOR = 'div.prose'; // 对话内容容器，需要找到包含所有聊天记录的父元素

    // --- 全局状态 ---
    let conversationHistory = []; // 对话历史
    let isRunning = false;
    let observer = null; // MutationObserver，用于监视发送按钮状态

    // --- 安全的日志系统 ---
    const Logger = {
        log: function (...args) {
            try {
                if (typeof GM_log !== 'undefined') {
                    GM_log('[UserScript] ' + args.join(' '));
                }
                if (typeof console !== 'undefined' && console.log) {
                    console.log('[UserScript]', ...args);
                }
            } catch (error) {
                // 静默处理错误
            }
        },
        error: function (...args) {
            try {
                if (typeof GM_log !== 'undefined') {
                    GM_log('[UserScript ERROR] ' + args.join(' '));
                }
                if (typeof console !== 'undefined' && console.error) {
                    console.error('[UserScript]', ...args);
                }
            } catch (error) {
                // 静默处理错误
            }
        },
        info: function (...args) {
            try {
                if (typeof GM_log !== 'undefined') {
                    GM_log('[UserScript INFO] ' + args.join(' '));
                }
                if (typeof console !== 'undefined' && console.info) {
                    console.info('[UserScript]', ...args);
                }
            } catch (error) {
                // 静默处理错误
            }
        }
    };

    // --- 调试功能 ---
    function debugPageStructure() {
        Logger.info("=== 页面结构调试 ===");

        // 查找输入框
        const inputs = document.querySelectorAll('textarea, input[type="text"]');
        Logger.info(`找到 ${inputs.length} 个输入框:`);
        inputs.forEach((input, index) => {
            Logger.info(`输入框 ${index + 1}:`, {
                tagName: input.tagName,
                placeholder: input.placeholder,
                id: input.id,
                className: input.className
            });
        });

        // 查找所有图片
        const images = document.querySelectorAll('img');
        Logger.info(`找到 ${images.length} 个图片:`);
        images.forEach((img, index) => {
            if (img.src.includes('data:image') || img.className.includes('icon')) {
                Logger.info(`图片 ${index + 1} (可能是按钮):`, {
                    className: img.className,
                    src: img.src.substring(0, 50) + '...',
                    parentTag: img.parentElement ? img.parentElement.tagName : 'none',
                    parentClass: img.parentElement ? img.parentElement.className : 'none'
                });
            }
        });

        // 查找所有按钮
        const buttons = document.querySelectorAll('button, [role="button"], .btn, .button');
        Logger.info(`找到 ${buttons.length} 个按钮或按钮样式元素:`);
        buttons.forEach((btn, index) => {
            Logger.info(`按钮 ${index + 1}:`, {
                tagName: btn.tagName,
                className: btn.className,
                disabled: btn.disabled,
                innerHTML: btn.innerHTML.substring(0, 100) + '...'
            });
        });

        // 查找聊天容器
        const containers = document.querySelectorAll('div.prose, .chat, .messages, [class*="chat"], [class*="message"]');
        Logger.info(`找到 ${containers.length} 个可能的聊天容器:`);
        containers.forEach((container, index) => {
            Logger.info(`容器 ${index + 1}:`, {
                className: container.className,
                childrenCount: container.children.length
            });
        });
    }

    function testButtonClick() {
        Logger.info("=== 测试按钮点击 ===");
        const sendButton = findSendButton();
        if (sendButton) {
            Logger.info("找到发送按钮:", {
                tagName: sendButton.tagName,
                className: sendButton.className,
                disabled: sendButton.disabled,
                isDisabled: isButtonDisabled(sendButton)
            });

            // 测试点击
            try {
                sendButton.click();
                Logger.info("按钮点击成功");
            } catch (error) {
                Logger.error("按钮点击失败:", error);
            }
        } else {
            Logger.error("未找到发送按钮");
        }
    }

    function testInputFill() {
        Logger.info("=== 测试输入框填充 ===");
        const inputArea = document.querySelector(INPUT_SELECTOR);
        if (inputArea) {
            Logger.info("找到输入框:", {
                tagName: inputArea.tagName,
                placeholder: inputArea.placeholder,
                value: inputArea.value
            });

            // 测试填充
            const testText = "这是一个测试消息";
            inputArea.value = testText;
            inputArea.dispatchEvent(new Event('input', { bubbles: true }));

            Logger.info("输入框填充测试完成，当前值:", inputArea.value);
        } else {
            Logger.error("未找到输入框");
        }
    }

    // --- DOM & 状态监控 ---
    function findSendButton() {
        try {
            const img = document.querySelector(SEND_BUTTON_SELECTOR);
            if (img) {
                let button = img.closest('button');
                if (button) return button;

                let clickableParent = img.closest('[onclick], [role="button"], .btn, .button');
                if (clickableParent) return clickableParent;

                return img;
            }
            return null;
        } catch (error) {
            Logger.error("查找发送按钮时出错:", error);
            return null;
        }
    }

    function isButtonDisabled(button) {
        try {
            if (button.disabled) return true;
            if (button.hasAttribute('aria-disabled') && button.getAttribute('aria-disabled') === 'true') return true;
            if (button.classList.contains('disabled')) return true;

            const computedStyle = window.getComputedStyle(button);
            if (computedStyle.pointerEvents === 'none') return true;
            if (computedStyle.opacity === '0.5' || computedStyle.opacity === '0') return true;

            if (button.style.color === 'grey' || button.style.color === 'gray') return true;

            const parent = button.parentElement;
            if (parent && (parent.disabled || parent.classList.contains('disabled'))) return true;

            return false;
        } catch (error) {
            Logger.error("检查按钮状态时出错:", error);
            return true;
        }
    }

    // --- 菜单命令 ---
    function setupApiKey() {
        try {
            const key = prompt('请输入你的DeepSeek API Key:', '');
            if (key) {
                GM_setValue(DEEPSEEK_API_KEY_STORAGE, key);
                alert('API Key已保存。');
            }
        } catch (error) {
            Logger.error("设置API Key时出错:", error);
            alert('设置API Key失败，请检查控制台错误信息。');
        }
    }

    // --- 安全初始化 ---
    function safeInitialize() {
        try {
            Logger.info("调试版用户脚本正在初始化...");

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', function () {
                    Logger.info("DOM加载完成，开始调试分析...");
                    setTimeout(debugPageStructure, 1000);
                });
            } else {
                Logger.info("页面已加载，开始调试分析...");
                setTimeout(debugPageStructure, 1000);
            }

            // 注册调试菜单命令
            GM_registerMenuCommand('🔍 调试页面结构', debugPageStructure);
            GM_registerMenuCommand('🧪 测试按钮点击', testButtonClick);
            GM_registerMenuCommand('📝 测试输入框填充', testInputFill);
            GM_registerMenuCommand('🔑 配置DeepSeek API Key', setupApiKey);

            Logger.info("调试版脚本初始化完成。");
        } catch (error) {
            if (typeof console !== 'undefined' && console.error) {
                console.error('[UserScript] 初始化失败:', error);
            }
        }
    }

    // 启动脚本
    safeInitialize();

})();
