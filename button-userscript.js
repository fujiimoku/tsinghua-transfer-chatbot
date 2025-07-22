// ==UserScript==
// @name         清小转 & DeepSeek 自动对话机器人 (按钮监控版)
// @namespace    http://tampermonkey.net/
// @version      1.5-button
// @description  自动使用DeepSeek API与清华大学转系咨询智能助手进行连续对话 - 按钮图标监控版本
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
    const CHAT_CONTAINER_SELECTOR = 'div.chat-list'; // 对话内容容器
    const CHAT_MESSAGE_SELECTOR = 'div.chat-message'; // 单个聊天消息
    const BOT_MESSAGE_SELECTOR = 'div.markdown-body'; // AI回复的markdown内容

    // --- 图标状态常量 ---
    const ICON_STATES = {
        SENDING: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAMAAACdt4HsAAAAHlBMVEVHcEx2Yv94YP90YP92YP94Yv92YP92YP90YP92YP8O/2LeAAAACXRSTlMAgUC/qTDz9+8StIpgAAABk0lEQVR4AcWV0aLCIAxDbbKp/P8P33knjEKBMh7sK+SQtK4+mgURkiGQctRjroBDqWuGUavPoizJTx9r8jFiKB8QUEQG8GnoMQR1gJY+u0YWtyBjE9cVmm9kPqSrp8OidA67bW7fkmGH+gQM7aei+VLUPxxlEWRCnwisg/n0KS/KAO4PFoUFmdQnBbQBvz62gXcNpBDIaEq/b8/qM972loXawP6yFsFrty1I3YHNXiVbbeECqARPGxDsDMYvOzgA3wxmAhcgPWwk8AHi8G4DZBVwNoHZOH4FMI58gKhcBvy+B7cBy78DDeB9AIwzFyBE66FuggdwPcw6Q2OhvK0E1ziy8qy0UABUBsdSzfeQkcFY62+91vPhGRaGpf+MDAuj0mOBws0biBb8IaT8XXwtuAmhsvy14GwD68jRAif01nbwEEA7b+zLaBZo3vMRerfSWRuR7NtXMoL05a0nLsJxpegReMk7FtX3JyI4MACE6gCeJrWL/d+rrMlHCPq+liLyrPxkVD6IqZX1zxD5zI6klEPN6g+I/zdPgIYolgAAAABJRU5ErkJggg==",
        READY: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAMAAABg3Am1AAAAD1BMVEVHcEzDzeXDz+fDy+fDzec6aW1CAAAABHRSTlMAgb9ARuXkygAAALxJREFUeAHtlFESgzAIRF3g/mdunNqYICTLpzPls32EZUGOf7wmVMxAwyd9hnJPX7QxJfSGiQqObsHIHgOM7H2CxnCiaEGbSYkOFCW49HecqUh1JC1oJkMyjxIeqalBzyMfmerb0PGneGpwtmO7F5h4XY95SoHzYfEpoP8vXEJLgT48OPaB5eLtPCYOxmMktQSiBSkqmreXunmoKZpEkUdVqwm3KJLvougz/xPFJ1wleP4770KBJgrMor4xPnN0CVXOkyYrAAAAAElFTkSuQmCC"
    };

    // --- 全局状态 ---
    let conversationHistory = []; // 对话历史
    let isRunning = false;
    let isWaitingForResponse = false; // 是否正在等待回复

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

    // --- 按钮图标监控系统 ---
    function monitorButtonIconChange(callback) {
        let checkCount = 0;
        let hasSendingIconBeenDetected = false;

        const checkInterval = setInterval(() => {
            if (!isRunning || !isWaitingForResponse) {
                clearInterval(checkInterval);
                return;
            }

            const sendButton = findSendButton();
            if (!sendButton) {
                Logger.log("未找到发送按钮，继续等待...");
                return;
            }

            const iconImg = sendButton.querySelector('img.icon') || sendButton;
            if (!iconImg || !iconImg.src) {
                Logger.log("未找到按钮图标，继续等待...");
                return;
            }

            const currentIconSrc = iconImg.src;
            checkCount++;

            // 检查是否是发送中图标
            if (isSendingIcon(currentIconSrc)) {
                if (!hasSendingIconBeenDetected) {
                    Logger.log("检测到发送中图标");
                    hasSendingIconBeenDetected = true;
                }
            }
            // 检查是否变为准备就绪图标
            else if (isReadyIcon(currentIconSrc)) {
                if (hasSendingIconBeenDetected) {
                    Logger.log("检测到图标从发送中变为准备就绪 - 对话已结束");
                    clearInterval(checkInterval);
                    isWaitingForResponse = false;
                    setTimeout(() => {
                        callback();
                    }, 1000); // 等待1秒确保所有内容都已加载
                    return;
                } else {
                    Logger.log("检测到准备就绪图标，但之前未检测到发送中图标，继续等待...");
                }
            }

            // 注意：移除了超时限制，因为AI回答时间可能较长
            // 脚本将耐心等待直到检测到完整的图标状态转换
        }, 1000); // 每秒检查一次
    }

    function isSendingIcon(iconSrc) {
        // 检查图标是否为发送中状态
        return iconSrc.includes('iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAMAAACdt4Hs') ||
            iconSrc.includes('Yv94YP90YP92YP94Yv92YP92YP90YP92YP8O');
    }

    function isReadyIcon(iconSrc) {
        // 检查图标是否为准备就绪状态
        return iconSrc.includes('iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAMAAABg3Am1') ||
            iconSrc.includes('DzeXDz+fDy+fDzec6aW1C');
    }

    // --- DeepSeek API 调用函数 ---
    async function getNextQuestionFromDeepSeek(context) {
        const apiKey = GM_getValue(DEEPSEEK_API_KEY_STORAGE);
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
                    model: "deepseek-chat",
                    messages: [
                        {
                            "role": "system",
                            "content": `你是一个聪明的助手，帮助学生与清华大学转系智能助手进行深入对话。

个人背景信息：
- GPA: 3.76
- 目标：想要转到自动化系
- 年级：大一
- 态度：降转不降转都可以
- 兴趣：对人工智能感兴趣
- 英语：还没考试，但感觉还可以
- 科研：没有科研经历

请基于之前的对话，提出下一个最相关、最有深度的问题。问题类型可以包括：

1. **学术准备类**：课程选择、成绩要求、学习建议
2. **申请流程类**：申请材料、时间节点、面试准备
3. **个人决策类**：专业选择的纠结、未来规划的困惑
4. **心理状态类**：转系压力、焦虑情绪、信心建设
5. **实践经验类**：科研机会、实习建议、能力提升
6. **政策细节类**：转系政策、录取标准、竞争情况

请只返回问题本身，不要包含任何额外解释或前缀。问题要自然、具体，体现出一个真实学生的关切和困惑。`
                        },
                        ...context,
                    ],
                    max_tokens: 100,
                    temperature: 0.7,
                }),
                onload: function (response) {
                    if (response.status === 200) {
                        try {
                            const result = JSON.parse(response.responseText);
                            resolve(result.choices[0].message.content.trim());
                        } catch (parseError) {
                            Logger.error('Failed to parse DeepSeek response:', parseError);
                            reject('Failed to parse API response');
                        }
                    } else {
                        Logger.error('DeepSeek API Error:', response.status, response.responseText);
                        reject('API request failed');
                    }
                },
                onerror: function (error) {
                    Logger.error('Network Error:', error);
                    reject('Network error');
                }
            });
        });
    }

    // --- 核心控制逻辑 ---
    function typeAndSend(text) {
        const inputArea = document.querySelector(INPUT_SELECTOR);
        if (!inputArea) {
            Logger.error("找不到输入框!");
            stopAutomation();
            return;
        }

        try {
            inputArea.value = '';
            inputArea.focus();
            inputArea.value = text;

            inputArea.dispatchEvent(new Event('input', { bubbles: true }));
            inputArea.dispatchEvent(new Event('change', { bubbles: true }));
            inputArea.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' }));

            Logger.log(`已输入文本: ${text}`);

            setTimeout(() => {
                const sendButton = findSendButton();
                if (!sendButton) {
                    Logger.error("找不到发送按钮。");
                    stopAutomation();
                    return;
                }

                Logger.log("找到发送按钮:", sendButton.tagName, sendButton.className);

                if (!isButtonDisabled(sendButton)) {
                    Logger.log("按钮可点击，准备发送...");

                    try {
                        sendButton.click();
                    } catch (clickError) {
                        Logger.error("标准点击失败，尝试模拟点击:", clickError);
                        sendButton.dispatchEvent(new MouseEvent('click', {
                            bubbles: true,
                            cancelable: true,
                            view: window
                        }));
                    }

                    Logger.log(`已发送问题: ${text}`);
                    conversationHistory.push({ role: 'user', content: text });

                    // 开始监控按钮图标变化
                    startButtonMonitoring();
                } else {
                    Logger.error("发送按钮不可点击");
                    stopAutomation();
                }
            }, 1000);
        } catch (error) {
            Logger.error("发送消息时出错:", error);
            stopAutomation();
        }
    }

    function startButtonMonitoring() {
        isWaitingForResponse = true;
        Logger.log("开始监控按钮图标变化...");

        monitorButtonIconChange(() => {
            Logger.log("检测到按钮图标变为准备就绪状态，处理回复...");
            handleNewResponse();
        });
    }

    function handleNewResponse() {
        try {
            const lastResponse = getLatestBotResponse();
            if (!lastResponse) {
                Logger.error("未能获取到最新的机器人回复。");
                stopAutomation();
                return;
            }

            Logger.log(`获取到回复: ${lastResponse.substring(0, 50)}...`);
            conversationHistory.push({ role: 'assistant', content: lastResponse });

            getNextQuestionFromDeepSeek(conversationHistory).then(nextQuestion => {
                if (nextQuestion && isRunning) {
                    Logger.log(`DeepSeek生成了新问题: ${nextQuestion}`);
                    setTimeout(() => typeAndSend(nextQuestion), 2000);
                } else {
                    Logger.log("无法从DeepSeek获取新问题或任务已停止。");
                    stopAutomation();
                }
            }).catch(error => {
                Logger.error("调用DeepSeek失败:", error);
                stopAutomation();
            });
        } catch (error) {
            Logger.error("处理回复时出错:", error);
            stopAutomation();
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

    function getLatestBotResponse() {
        try {
            // 方法1: 直接查找所有聊天消息
            const chatMessages = document.querySelectorAll(CHAT_MESSAGE_SELECTOR);
            if (chatMessages.length > 0) {
                // 从最后一条消息开始往前找，寻找AI的回复（包含markdown-body的消息）
                for (let i = chatMessages.length - 1; i >= 0; i--) {
                    const message = chatMessages[i];
                    const markdownBody = message.querySelector(BOT_MESSAGE_SELECTOR);
                    if (markdownBody) {
                        const messageText = markdownBody.innerText.trim();
                        if (messageText && messageText.length >= 10) {
                            Logger.log(`提取到的回复内容（前100字符）: ${messageText.substring(0, 100)}...`);
                            return messageText;
                        }
                    }
                }
            }

            // 方法2: 如果上面失败，尝试查找聊天容器
            const chatContainer = document.querySelector(CHAT_CONTAINER_SELECTOR);
            if (chatContainer) {
                const messages = chatContainer.querySelectorAll(BOT_MESSAGE_SELECTOR);
                if (messages.length > 0) {
                    const lastMessage = messages[messages.length - 1];
                    const messageText = lastMessage.innerText.trim();

                    if (messageText && messageText.length >= 10) {
                        Logger.log(`提取到的回复内容（前100字符）: ${messageText.substring(0, 100)}...`);
                        return messageText;
                    }
                }
            }

            // 方法3: 最后的尝试 - 查找所有markdown-body
            const allMarkdownBodies = document.querySelectorAll('div.markdown-body');
            if (allMarkdownBodies.length > 0) {
                const lastMarkdown = allMarkdownBodies[allMarkdownBodies.length - 1];
                const messageText = lastMarkdown.innerText.trim();

                if (messageText && messageText.length >= 10) {
                    Logger.log(`提取到的回复内容（前100字符）: ${messageText.substring(0, 100)}...`);
                    return messageText;
                }
            }

            Logger.error("所有方法都无法获取到有效的回复内容");
            return null;
        } catch (error) {
            Logger.error("获取最新回复时出错:", error);
            return null;
        }
    }

    // --- 脚本控制 (开始/停止) ---
    function startAutomation() {
        if (isRunning) {
            Logger.log("自动化已在运行中。");
            return;
        }

        try {
            const firstQuestion = prompt("请输入第一个启动问题:", "我是大一学生，GPA 3.76，想转到自动化系。我对人工智能很感兴趣，但没有科研经历，英语还没考。请问转系需要做哪些准备？");
            if (!firstQuestion) {
                Logger.log("已取消启动。");
                return;
            }
            isRunning = true;
            isWaitingForResponse = false;
            Logger.log("自动化流程已启动...");
            typeAndSend(firstQuestion);
        } catch (error) {
            Logger.error("启动自动化时出错:", error);
            stopAutomation();
        }
    }

    function stopAutomation() {
        try {
            isRunning = false;
            isWaitingForResponse = false;
            Logger.log("自动化流程已停止。");
        } catch (error) {
            Logger.error("停止自动化时出错:", error);
        }
    }

    // --- 油猴菜单命令 ---
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
            Logger.info("按钮监控版用户脚本正在初始化...");

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', function () {
                    Logger.info("DOM加载完成，脚本已准备就绪。");
                });
            } else {
                Logger.info("脚本已准备就绪。");
            }

            GM_registerMenuCommand('🚀 开始自动对话', startAutomation);
            GM_registerMenuCommand('🛑 停止自动对话', stopAutomation);
            GM_registerMenuCommand('🔑 配置DeepSeek API Key', setupApiKey);

            Logger.info("按钮监控版脚本初始化完成。");
        } catch (error) {
            if (typeof console !== 'undefined' && console.error) {
                console.error('[UserScript] 初始化失败:', error);
            }
        }
    }

    // 启动脚本
    safeInitialize();

})();
