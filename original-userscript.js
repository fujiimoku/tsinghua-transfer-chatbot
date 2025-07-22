// ==UserScript==
// @name         清小转 & DeepSeek 自动对话机器人
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  自动使用DeepSeek API与清华大学转系咨询智能助手进行连续对话。
// @author       Your Name
// @match        https://www.xiaoda.tsinghua.edu.cn/chat/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @connect      api.deepseek.com
// ==/UserScript==

(function () {
    'use strict';

    // --- 配置区域 ---
    const DEEPSEEK_API_KEY_STORAGE = 'DEEPSEEK_API_KEY';

    // --- UI 选择器 (根据页面实际情况可能需要微调) ---
    const INPUT_SELECTOR = 'textarea[placeholder="输入问题，即刻解答！"]'; // 输入框
    const SEND_BUTTON_SELECTOR = 'button > span > svg'; // 发送按钮的SVG图标
    const CHAT_CONTAINER_SELECTOR = 'div.prose'; // 对话内容容器，需要找到包含所有聊天记录的父元素

    // --- 全局状态 ---
    let conversationHistory = []; // 对话历史
    let isRunning = false;
    let observer = null; // MutationObserver，用于监视发送按钮状态

    // --- DeepSeek API 调用函数 ---
    async function getNextQuestionFromDeepSeek(context) {
        const apiKey = await GM_getValue(DEEPSEEK_API_KEY_STORAGE);
        if (!apiKey) {
            alert('请先配置您的DeepSeek API Key!');
            return null;
        }

        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "POST",
                url: "https://api.deepseek.com/chat/completions",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                data: JSON.stringify({
                    model: "deepseek-chat", // 或者其他你偏好的模型
                    messages: [
                        {
                            "role": "system",
                            "content": `你是一个聪明的助手，你的任务是基于之前和清华大学转系智能助手的对话，提出下一个最相关、最有深度的问题。请只返回问题本身，不要包含任何额外解释或前缀，例如 "好的，下一个问题是："。你的目标是尽可能全面地了解关于清华转系的所有信息。`
                        },
                        ...context, // 之前的对话历史
                    ],
                    max_tokens: 100,
                    temperature: 0.7,
                }),
                onload: function (response) {
                    if (response.status === 200) {
                        const result = JSON.parse(response.responseText);
                        resolve(result.choices[0].message.content.trim());
                    } else {
                        console.error('DeepSeek API Error:', response.status, response.responseText);
                        reject('API request failed');
                    }
                },
                onerror: function (error) {
                    console.error('Network Error:', error);
                    reject('Network error');
                }
            });
        });
    }


    // --- 核心控制逻辑 ---
    function typeAndSend(text) {
        const inputArea = document.querySelector(INPUT_SELECTOR);
        if (!inputArea) {
            console.error("找不到输入框!");
            stopAutomation();
            return;
        }
        inputArea.value = text;
        inputArea.dispatchEvent(new Event('input', { bubbles: true })); // 触发React等框架的状态更新

        // 等待一小会儿，确保发送按钮状态更新
        setTimeout(() => {
            const sendButton = findSendButton();
            if (sendButton && !isButtonDisabled(sendButton)) {
                sendButton.click();
                console.log(`已发送问题: ${text}`);
                conversationHistory.push({ role: 'user', content: text });
                // 问题发送后，开始监视按钮变回可点击状态
                startObserving();
            } else {
                console.error("找不到发送按钮或按钮不可点击。");
                stopAutomation();
            }
        }, 500);
    }

    function handleNewResponse() {
        console.log("检测到智能助手回复完毕。");
        // 停止监视，避免重复触发
        stopObserving();

        // 1. 获取最新的回复
        const lastResponse = getLatestBotResponse();
        if (!lastResponse) {
            console.error("未能获取到最新的机器人回复。");
            stopAutomation();
            return;
        }
        console.log(`获取到回复: ${lastResponse.substring(0, 50)}...`);
        conversationHistory.push({ role: 'assistant', content: lastResponse });

        // 2. 将上下文发送给DeepSeek获取下一个问题
        getNextQuestionFromDeepSeek(conversationHistory).then(nextQuestion => {
            if (nextQuestion && isRunning) {
                console.log(`DeepSeek生成了新问题: ${nextQuestion}`);
                // 3. 发送新问题
                setTimeout(() => typeAndSend(nextQuestion), 1000); // 等待1秒再发送，模仿人类操作
            } else {
                console.log("无法从DeepSeek获取新问题或任务已停止。");
                stopAutomation();
            }
        }).catch(error => {
            console.error("调用DeepSeek失败:", error);
            stopAutomation();
        });
    }

    // --- DOM & 状态监控 ---

    function findSendButton() {
        // SVG的父元素通常是button
        const svg = document.querySelector(SEND_BUTTON_SELECTOR);
        return svg ? svg.closest('button') : null;
    }

    function isButtonDisabled(button) {
        // 从图片上看，按钮颜色变化可能与`disabled`属性或CSS类有关
        // 这是一个通用的检查，如果无效，需要根据实际DOM情况调整
        return button.disabled || button.style.color === 'grey' || button.classList.contains('disabled');
    }

    function getLatestBotResponse() {
        // 这个选择器需要非常精确，可能需要你手动检查页面DOM结构
        // 假设每个回复都在一个特定的div里，并且机器人的回复有独特的标识
        const chatContainer = document.querySelector(CHAT_CONTAINER_SELECTOR);
        if (!chatContainer) return null;
        // 通常最后一个元素是最新回复。这里需要细化，例如通过class区分用户和机器人的消息
        const messages = chatContainer.querySelectorAll('div.markdown-body'); // 假设机器人的回复有这个class
        return messages.length > 0 ? messages[messages.length - 1].innerText : null;
    }

    function startObserving() {
        const sendButton = findSendButton();
        if (!sendButton) return;

        observer = new MutationObserver((mutationsList, obs) => {
            const currentButton = findSendButton(); // 重新获取按钮，因为DOM可能已改变
            // 当按钮从"发送中"（通常是灰色/禁用）变为"可发送"（紫色/启用）时
            if (currentButton && !isButtonDisabled(currentButton)) {
                // 这是我们认为"回复已完成"的信号
                handleNewResponse();
            }
        });

        // 监视按钮及其子元素属性和结构的变化
        observer.observe(sendButton.parentElement, { attributes: true, childList: true, subtree: true });
        console.log("正在监视发送按钮状态...");
    }

    function stopObserving() {
        if (observer) {
            observer.disconnect();
            observer = null;
            console.log("已停止监视。");
        }
    }

    // --- 脚本控制 (开始/停止) ---
    function startAutomation() {
        if (isRunning) {
            console.log("自动化已在运行中。");
            return;
        }
        const firstQuestion = prompt("请输入第一个启动问题:", "我想转到计算机系，需要做哪些准备？");
        if (!firstQuestion) {
            console.log("已取消启动。");
            return;
        }
        isRunning = true;
        console.log("自动化流程已启动...");
        typeAndSend(firstQuestion);
    }

    function stopAutomation() {
        isRunning = false;
        stopObserving();
        console.log("自动化流程已停止。");
    }

    // --- 缺失的函数：这是导致错误的原因 ---
    function startConsoleListener() {
        // 这个函数试图修改console.log属性，但console对象的某些属性是只读的
        // 错误的代码示例（导致错误）：
        // console.log = function() { /* 自定义逻辑 */ };

        // 正确的方法：保存原始console.log并创建包装函数
        const originalConsoleLog = console.log;

        // 使用一个安全的方法来包装console功能
        window.customConsoleLog = function (...args) {
            // 添加自定义逻辑
            originalConsoleLog.apply(console, ['[UserScript]', ...args]);
        };

        // 不要直接修改console.log，而是使用自定义函数
        console.info("Console listener started safely");
    }

    // --- 油猴菜单命令 ---
    function setupApiKey() {
        const key = prompt('请输入你的DeepSeek API Key:', '');
        if (key) {
            GM_setValue(DEEPSEEK_API_KEY_STORAGE, key);
            alert('API Key已保存。');
        }
    }

    // 初始化
    startConsoleListener(); // 添加这行来初始化控制台监听器

    GM_registerMenuCommand('🚀 开始自动对话', startAutomation);
    GM_registerMenuCommand('🛑 停止自动对话', stopAutomation);
    GM_registerMenuCommand('🔑 配置DeepSeek API Key', setupApiKey);

})();
