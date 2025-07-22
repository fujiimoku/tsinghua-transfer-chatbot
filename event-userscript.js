// ==UserScript==
// @name         清小转 & DeepSeek 自动对话机器人 (事件监听版)
// @namespace    http://tampermonkey.net/
// @version      1.4-event
// @description  自动使用DeepSeek API与清华大学转系咨询智能助手进行连续对话 - 事件监听版本
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

    // --- 控制台事件监听系统 ---
    function setupStreamListener() {
        // 拦截控制台日志来监听stream事件
        const originalConsoleLog = console.log;
        console.log = function (...args) {
            originalConsoleLog.apply(console, args);

            // 检查是否有stream onclose事件
            const message = args.join(' ');
            if (message.includes('stream onclose') && isWaitingForResponse) {
                Logger.log("检测到stream onclose事件");
                setTimeout(() => {
                    if (isRunning && isWaitingForResponse) {
                        Logger.log("stream关闭后处理回复...");
                        isWaitingForResponse = false;
                        handleNewResponse();
                    }
                }, 1000); // 等待1秒确保所有更新完成
            }
        };

        Logger.log("已设置stream事件监听器");
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
                            "content": `你是一个聪明的助手，你的任务是基于之前和清华大学转系智能助手的对话，提出下一个最相关、最有深度的问题。请只返回问题本身，不要包含任何额外解释或前缀，例如 "好的，下一个问题是："。你的目标是尽可能全面地了解关于清华转系的所有信息。`
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

                    // 设置等待状态
                    isWaitingForResponse = true;
                    Logger.log("开始等待AI回复...");
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
            const chatContainer = document.querySelector(CHAT_CONTAINER_SELECTOR);
            if (!chatContainer) {
                Logger.error("找不到聊天容器");
                return null;
            }

            const messages = chatContainer.querySelectorAll('div.markdown-body');
            if (messages.length === 0) {
                Logger.error("聊天容器中没有找到消息");
                return null;
            }

            const lastMessage = messages[messages.length - 1];
            let messageText = lastMessage.innerText.trim();

            if (!messageText) {
                Logger.error("最新消息为空");
                return null;
            }

            if (messageText.length < 10) {
                Logger.error("消息内容太短，可能还在生成中");
                return null;
            }

            Logger.log(`提取到的回复内容（前100字符）: ${messageText.substring(0, 100)}...`);
            return messageText;
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
            const firstQuestion = prompt("请输入第一个启动问题:", "我想转到计算机系，需要做哪些准备？");
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
            Logger.info("事件监听版用户脚本正在初始化...");

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', function () {
                    Logger.info("DOM加载完成，脚本已准备就绪。");
                    setupStreamListener();
                });
            } else {
                Logger.info("脚本已准备就绪。");
                setupStreamListener();
            }

            GM_registerMenuCommand('🚀 开始自动对话', startAutomation);
            GM_registerMenuCommand('🛑 停止自动对话', stopAutomation);
            GM_registerMenuCommand('🔑 配置DeepSeek API Key', setupApiKey);

            Logger.info("事件监听版脚本初始化完成。");
        } catch (error) {
            if (typeof console !== 'undefined' && console.error) {
                console.error('[UserScript] 初始化失败:', error);
            }
        }
    }

    // 启动脚本
    safeInitialize();

})();
