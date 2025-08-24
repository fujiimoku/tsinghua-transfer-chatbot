// ==UserScript==
// @name         清小转刷次数自动脚本
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  自动在广场页面循环进入清小转并发送快捷问题，刷次数专用
// @author       Your Name
// @match        https://www.xiaoda.tsinghua.edu.cn/square
// @match        https://www.xiaoda.tsinghua.edu.cn/chat/*
// @grant        GM_registerMenuCommand
// @grant        GM_log
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function () {
    'use strict';

    // --- 配置 ---
    const BOT_NAME = '清小转';
    const QUICK_QUESTION = '请详细介绍清小转的功能和使用方法';
    const SQUARE_URL = 'https://www.xiaoda.tsinghua.edu.cn/square';
    const WAIT_TIME = 15000; // 等待时间改为15秒

    // 使用 GM_setValue/GM_getValue 来持久化循环状态
    let isLooping = GM_getValue('isLooping', false);

    // --- 广场页面逻辑 ---
    function tryEnterBot() {
        const botItems = document.querySelectorAll('.item .name');
        for (const item of botItems) {
            if (item.textContent.includes(BOT_NAME)) {
                const parent = item.closest('.item');
                if (parent) {
                    GM_log('找到清小转，点击进入...');
                    parent.click();
                    // 进入清小转后，自动开始点击快捷提问
                    setTimeout(() => {
                        GM_log('已进入清小转，开始点击快捷提问...');
                        clickSuggestItem(QUICK_QUESTION);
                    }, 2000); // 等待页面加载
                    return true;
                }
            }
        }
        GM_log('未找到清小转，等待重试...');
        return false;
    }

    // --- 对话页面逻辑（点击快捷建议项） ---
    function clickSuggestItem(text) {
        const suggestItems = document.querySelectorAll('.suggest-list-item');
        for (const item of suggestItems) {
            const textContent = item.textContent.trim();
            if (textContent.includes(text) || textContent.includes('请详细介绍清小转的功能和使用方法')) {
                GM_log('找到快捷建议项，点击发送...');
                try {
                    item.click();
                } catch (e) {
                    item.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                }
                GM_log('已点击快捷建议项，等待15秒后返回广场...');
                // 直接等待15秒后返回广场，不监控按钮状态
                setTimeout(() => {
                    GM_log('15秒等待结束，返回广场继续循环');
                    if (GM_getValue('isLooping', false)) {
                        // 保存状态并跳转
                        GM_setValue('needContinueLoop', true);
                        window.location.href = SQUARE_URL;
                    }
                }, WAIT_TIME);
                return;
            }
        }
        GM_log('未找到匹配的快捷建议项，等待重试...');
        setTimeout(() => clickSuggestItem(text), 1000);
    }

    // --- 按钮图标监控（简化版） ---
    function monitorButtonIcon(callback) {
        const SENDING_ICON = 'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAMAAACdt4Hs';
        const READY_ICON = 'iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAMAAABg3Am1';
        let hasSendingIconBeenDetected = false;
        const interval = setInterval(() => {
            const sendBtnImg = document.querySelector('img.icon');
            if (!sendBtnImg) return;
            const src = sendBtnImg.src;
            if (src.includes(SENDING_ICON)) {
                hasSendingIconBeenDetected = true;
            }
            if (hasSendingIconBeenDetected && src.includes(READY_ICON)) {
                clearInterval(interval);
                setTimeout(callback, 1000);
            }
        }, 1000);
    }

    // --- 主循环控制 ---
    function startLoop() {
        isLooping = true;
        GM_setValue('isLooping', true);
        GM_log('刷次数自动循环已启动');
        runMainLoop();
    }

    function runMainLoop() {
        const currentLoopState = GM_getValue('isLooping', false);
        if (!currentLoopState) return;

        if (window.location.pathname === '/square') {
            GM_log('在广场页面，寻找清小转...');
            const tryClick = () => {
                if (!GM_getValue('isLooping', false)) return;
                if (!tryEnterBot()) {
                    setTimeout(tryClick, 1000);
                }
            };
            tryClick();
        } else if (window.location.pathname.startsWith('/chat')) {
            GM_log('在聊天页面，开始点击快捷提问...');
            // 如果已经在聊天页面，直接开始点击快捷提问
            setTimeout(() => clickSuggestItem(QUICK_QUESTION), 1000);
        }
    }

    function stopLoop() {
        isLooping = false;
        GM_setValue('isLooping', false);
        GM_setValue('needContinueLoop', false);
        GM_log('刷次数自动循环已停止');
    }

    // --- 菜单命令 ---
    GM_registerMenuCommand('🚀 开始刷次数循环', startLoop);
    GM_registerMenuCommand('🛑 停止刷次数循环', stopLoop);

    // --- 自动启动（可选） ---
    // startLoop();

    // --- 页面加载监听，用于返回广场后继续循环 ---
    window.addEventListener('load', () => {
        // 检查是否需要继续循环
        if (GM_getValue('needContinueLoop', false) && window.location.pathname === '/square') {
            GM_log('检测到需要继续循环，返回广场后重新开始...');
            GM_setValue('needContinueLoop', false); // 清除标记
            isLooping = true; // 恢复本地状态
            setTimeout(() => runMainLoop(), 1000); // 延迟1秒确保页面完全加载
        }
    });

    // --- 页面初始化检查 ---
    // 页面加载时检查是否有正在进行的循环
    if (GM_getValue('isLooping', false)) {
        GM_log('检测到循环状态，准备继续...');
        isLooping = true;
        if (window.location.pathname === '/square') {
            setTimeout(() => runMainLoop(), 1000);
        } else if (window.location.pathname.startsWith('/chat')) {
            setTimeout(() => runMainLoop(), 1000);
        }
    }

})();
